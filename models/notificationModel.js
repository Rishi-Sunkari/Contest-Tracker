const { db } = require('../firebase');

const Notification = db.collection('notifications');

module.exports = Notification;