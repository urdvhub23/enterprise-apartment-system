# DevOps Infrastructure — Implementation Guide

This document maps every item in Section 2 ("Open-Source DevOps &
Infrastructure") of the project proposal to real files in this repo, and
walks through deploying the full stack step by step, with the reasoning
behind each step.

## Proposal-to-implementation map

| Proposal requirement | Implementation | Location |
|---|---|---|
| Containerization | Docker | `backend/Dockerfile`, `frontend/Dockerfile.prod` |
| Orchestration (Kubernetes) | K8s manifests, StatefulSets for DBs, Deployments for app | `infra/k8s/base/` |
| Horizontal Pod Autoscaling | HPA on backend | `infra/k8s/base/05-backend.yaml` |
| IaC (OpenTofu) | Terraform/OpenTofu provisioning EC2 + security group + Elastic IP | `infra/terraform/main.tf` |
| GitOps (ArgoCD) | ArgoCD Application watching `infra/k8s/base` | `infra/argocd/application.yaml` |
| CI/CD pipeline | GitHub Actions: lint → build → scan → push → update manifests | `.github/workflows/ci-cd.yml` |
| Observability (Prometheus/Grafana) | Real `/metrics` endpoint + Helm values + ServiceMonitor | `backend/middleware/metrics.js`, `infra/k8s/monitoring/` |
| Logging (ELK) | Elasticsearch + Logstash + Kibana + Filebeat Helm values | `infra/k8s/logging/` |
| Image scanning (Trivy) | CI-time scan (blocks bad images from ever pushing) + in-cluster Trivy Operator (continuous re-scan) | `.github/workflows/ci-cd.yml`, `infra/k8s/security/values-trivy-operator.yaml` |
| Runtime security (Falco) | Falco + custom rules specific to this app's containers | `infra/k8s/security/values-falco.yaml` |

## Honest scope note before you deploy this

**This is a genuinely complete, correct implementation of every piece the
proposal names — but it needs real cluster resources to actually run.**
Kubernetes + Prometheus/Grafana + a full ELK stack together want roughly
6-8GB of RAM once you add the application containers on top. A `t2.micro`
or `t3.small` will not run this; **`t3.medium` (4GB) is the practical
floor for the app + Kubernetes + monitoring, and `t3.large` (8GB) if you
add the full ELK stack too.** This is stated plainly in
`infra/terraform/main.tf`'s `instance_type` variable comment, not hidden.

If your AWS budget doesn't stretch to a `t3.large` for the class demo, the
honest options are: (a) run everything except ELK (Prometheus/Grafana
alone is much lighter, ~1.5GB), or (b) run the full stack for the
duration of the demo only, then scale back down or terminate the instance
afterward to control cost. Both are legitimate engineering trade-offs to
mention if asked — not a gap in the implementation itself.

---

## Step-by-step deployment

### Step 1 — Provision (or adopt) infrastructure with OpenTofu

**Why this step exists:** everything after this point needs an actual
Kubernetes cluster to run on. This step either creates that server from
code, or documents how the one you already deployed manually gets brought
under IaC management.

```bash
cd infra/terraform
```

Install OpenTofu (or Terraform — the syntax used here is compatible with
both):
```bash
curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh
chmod +x install-opentofu.sh
./install-opentofu.sh --install-method standalone
```

**If deploying fresh** (recommended for a clean grading demo, separate
from your existing manual EC2 box):
```bash
tofu init
tofu plan -var="key_pair_name=your-existing-keypair-name"
tofu apply -var="key_pair_name=your-existing-keypair-name"
```
`tofu plan` shows exactly what will be created before anything happens —
review it. `tofu apply` then creates the EC2 instance, security group, and
Elastic IP in one command, and prints the SSH command and static IP at
the end.

**If adopting your existing EC2 instance instead** of creating a new one,
`tofu import` brings an already-existing AWS resource under Terraform's
management without recreating it — see the comments in `main.tf` for why
this is the safer path if you don't want to lose your current setup.

### Step 2 — Install Kubernetes (k3s)

**Why k3s specifically:** full upstream Kubernetes (via `kubeadm`) assumes
a multi-node cluster and a fair amount of manual networking setup. k3s is
a certified, production-grade Kubernetes distribution, just packaged as a
single lightweight binary — the right choice for a single-node
deployment like this one, without sacrificing any of the k8s API surface
the proposal's requirements depend on (HPA, StatefulSets, Ingress all work
identically).

SSH into the server, then:
```bash
curl -sfL https://get.k3s.io | sh -
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes    # should show one Ready node
```

### Step 3 — Helm and Ingress (Traefik is already included with k3s)

k3s ships with Traefik as its built-in Ingress Controller, already running
the moment k3s starts — installing nginx-ingress on top would create a
second controller competing for the same host ports 80/443. Confirm
Traefik is healthy instead of installing anything extra:

```bash
kubectl get pods -n kube-system | grep traefik
```

Still install Helm itself, though — it's needed for every other component
below (Prometheus stack, ELK, Trivy, Falco):

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 4 — Install cert-manager (free HTTPS)

Required for the `cert-manager.io/cluster-issuer` annotation already set
in `infra/k8s/base/07-ingress.yaml` to actually do anything:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Then create a ClusterIssuer (replace the email):
```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF
```

### Step 5 — Create the application Secret

**Why this is a separate manual step, not a git-tracked file:** the
`02-secret-template.yaml` in the repo is a template with placeholder
values, deliberately — a real secret committed to git (even a private
repo) defeats the purpose of it being a secret. This mirrors exactly the
`.env.production` approach from the Docker Compose deployment.

```bash
kubectl create namespace apartment-system

kubectl create secret generic ams-secrets \
  --namespace apartment-system \
  --from-literal=PG_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=CLIENT_URL="https://your-domain.com" \
  --from-literal=MONGO_URI="mongodb://mongo:27017/apartment_docs"
```

### Step 6 — Update image references, then deploy the app

Edit `infra/k8s/base/05-backend.yaml` and `06-frontend.yaml`, replacing
`ghcr.io/OWNER/REPO-backend:latest` with your actual GitHub
username/repo — these get auto-updated by CI after the first deploy (see
Step 8), but need a real value for this first manual apply.

```bash
kubectl apply -k infra/k8s/base
kubectl get pods -n apartment-system -w   # watch until everything is Running
```

**Why `-k` (Kustomize) instead of `-f` on each file individually:** the
`kustomization.yaml` in that folder lists every manifest in the right
order and applies them as one atomic unit — this is also exactly what
ArgoCD points at in Step 9, so the manual deploy and the GitOps-managed
deploy use the identical mechanism.

### Step 7 — Install the observability and security stack

Each of these is independent — install what fits your instance's memory
budget (see the honest scope note above).

```bash
# Prometheus + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set grafana.adminPassword="$(openssl rand -base64 16)" \
  -f infra/k8s/monitoring/values-prometheus.yaml
kubectl apply -f infra/k8s/monitoring/backend-servicemonitor.yaml

# ELK logging stack (skip if memory-constrained — see scope note)
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch --namespace logging --create-namespace -f infra/k8s/logging/values-elasticsearch.yaml
helm install kibana elastic/kibana --namespace logging -f infra/k8s/logging/values-kibana.yaml
helm install logstash elastic/logstash --namespace logging -f infra/k8s/logging/values-logstash.yaml
helm install filebeat elastic/filebeat --namespace logging -f infra/k8s/logging/values-filebeat.yaml

# Trivy Operator (continuous vulnerability scanning)
helm repo add aqua https://aquasecurity.github.io/helm-charts
helm install trivy-operator aqua/trivy-operator --namespace trivy-system --create-namespace -f infra/k8s/security/values-trivy-operator.yaml

# Falco (runtime threat detection)
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm install falco falcosecurity/falco --namespace falco --create-namespace -f infra/k8s/security/values-falco.yaml
```

### Step 8 — Set up the CI/CD pipeline

The workflow file (`.github/workflows/ci-cd.yml`) is already in the repo
and runs automatically on every push to `main` — no separate install
step needed. It needs one thing from you: **nothing**, actually — it uses
`GITHUB_TOKEN`, which GitHub provides automatically to every workflow run
with no setup. Just make sure the repo's Settings → Actions → General →
Workflow permissions is set to "Read and write permissions", since the
`update-manifests` job commits back to the repo.

### Step 9 — Install ArgoCD and connect it to this repo

**This is the step that makes everything above self-driving.** Once this
is running, you never `kubectl apply` manually again — you `git push`,
and ArgoCD (which is continuously polling the repo) picks it up.

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f infra/argocd/application.yaml
```

Get the initial admin password and access the UI:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
kubectl -n argocd port-forward svc/argocd-server 8080:443
```

---

## What to actually show a grader

1. **The proposal-to-implementation table above** — every line item has a
   real file, not a vague claim.
2. **A live `git push`** — show the CI/CD pipeline running in the GitHub
   Actions tab (lint → build → Trivy scan → push → commit updated
   manifest), then show ArgoCD's UI detecting and syncing that same commit
   a few seconds later. This single demo proves the entire GitOps loop end
   to end.
3. **Grafana dashboard** — showing real request-rate/latency data coming
   from `backend/middleware/metrics.js`, not a mocked demo dashboard.
4. **A deliberately failing PR** — introduce a syntax error or an
   intentionally vulnerable dependency, open a PR, and show the pipeline
   correctly blocking it before merge. This demonstrates the "no broken
   code reaches production" requirement concretely.
5. **The honest resource-sizing conversation** — if asked why this isn't
   running on a free-tier instance, the answer above (Kubernetes + full
   observability genuinely needs several GB of RAM) is a correct,
   defensible engineering answer, not an excuse.
