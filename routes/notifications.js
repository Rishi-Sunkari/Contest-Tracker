const express = require('express');
const router = express.Router();
const Notification = require('../models/notificationModel.js');
const { isAuthenticated } = require('../middleware/auth.js');

// API Route: Subscribe to contest notifications
router.post('/subscribe-notification', isAuthenticated, async (req, res) => {
    try {
        const { contestId, contestName, platform, startTime, contestUrl } = req.body;
        const userId = req.session.user.id;
        const userEmail = req.session.user.email;

        // Check if user already subscribed to this contest
        const snapshot = await Notification.where('userId', '==', userId).where('contestId', '==', contestId).get();
        if (!snapshot.empty) {
            return res.json({
                success: false,
                message: 'You are already subscribed to this contest!'
            });
        }

        // Create new notification subscription
        await Notification.add({
            userId: userId,
            contestId: contestId,
            contestName: contestName,
            platform: platform,
            contestStartTime: new Date(startTime),
            contestUrl: contestUrl,
            userEmail: userEmail,
            notificationSent: false,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: 'Successfully subscribed! You will receive an email reminder 10 minutes before the contest starts.'
        });
    } catch (error) {
        console.error('Error subscribing to notification:', error);
        res.json({
            success: false,
            message: 'Error subscribing to notifications'
        });
    }
});

// API Route: Get user's subscribed contests
router.get('/my-notifications', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const snapshot = await Notification.where('userId', '==', userId)
            .where('contestStartTime', '>=', new Date())
            .orderBy('contestStartTime', 'asc')
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push(doc.data());
        });

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.json({ success: false, message: 'Error fetching notifications' });
    }
});

// API Route: Unsubscribe from contest notification
router.delete('/unsubscribe-notification/:contestId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const contestId = req.params.contestId;

        const snapshot = await Notification.where('userId', '==', userId).where('contestId', '==', contestId).get();

        if (snapshot.empty) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        const batch = Notification.firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        res.json({
            success: true,
            message: 'Successfully unsubscribed from contest notifications'
        });
    } catch (error) {
        console.error('Error unsubscribing:', error);
        res.json({ success: false, message: 'Error unsubscribing' });
    }
});

module.exports = router;