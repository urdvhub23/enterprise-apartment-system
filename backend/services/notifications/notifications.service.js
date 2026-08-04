const Notification = require('../../models/mongo/Notification');

// Internal helper other services call to log/dispatch a notification.
// In production this would also push to FCM/APNs/SMTP/SMS providers;
// here it persists to Mongo so the in-app feed always works, and logs the intent.
async function notifyUser(userId, { channel, type, title, body, metadata = {} }) {
  try {
    const notification = await Notification.create({
      userId, channel, type, title, body, metadata
    });
    // Placeholder hook for real channels — swap in provider SDKs as needed.
    if (channel === 'email') {
      // await sendEmail(...)
    }
    return notification;
  } catch (err) {
    console.error('[notifications.service] failed to record notification:', err.message);
    return null;
  }
}

module.exports = { notifyUser };
