const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Notification = require('../models/notificationModel.js');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'rishi250904email@gmail.com',
        pass: process.env.EMAIL_PASS || 'Rishi@9912'
    }
});

// Function to send email notification
async function sendContestNotification(userEmail, contestDetails) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'rishi250904email@gmail.com',
        to: userEmail,
        subject: `🚀 Contest Starting in 10 minutes: ${contestDetails.contestName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #4F46E5; text-align: center;">⏰ Contest Starting Soon! 🎯</h2>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Contest Details:</h3>
                <p><strong>Platform:</strong> <span style="color: #4F46E5;">${contestDetails.platform}</span></p>
                <p><strong>Contest Name:</strong> ${contestDetails.contestName}</p>
                <p><strong>Start Time:</strong> ${contestDetails.startTime}</p>
                <p><strong>Duration:</strong> ${contestDetails.duration} minutes</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${contestDetails.contestUrl}" 
                   style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                   Join Contest Now! 🚀
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
                Good luck and happy coding! 💻✨<br>
                <em>Contest Tracker Team</em>
            </p>
        </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
}

// Cron job to send email reminders (runs every 5 minutes to check for contests starting in 10 minutes)
cron.schedule('*/5 * * * *', async () => {
    console.log('🔔 Checking for contest reminders...');
    
    try {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() +   10 * 60 * 1000); // 10 minutes from now
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

        // Find contests starting between 5-10 minutes from now that haven't been notified
        const snapshot = await Notification.where('contestStartTime', '>=', fiveMinutesFromNow)
            .where('contestStartTime', '<=', tenMinutesFromNow)
            .where('notificationSent', '==', false)
            .get();

        console.log(`Found ${snapshot.docs.length} upcoming contests to notify`);

        for (const doc of snapshot.docs) {
            const notification = doc.data();
            const emailData = {
                contestName: notification.contestName,
                platform: notification.platform,
                startTime: notification.contestStartTime.toDate().toLocaleString(),
                duration: 'Check contest page',
                contestUrl: notification.contestUrl
            };

            const emailSent = await sendContestNotification(notification.userEmail, emailData);
            
            if (emailSent) {
                // Mark as sent
                await Notification.doc(doc.id).update({ notificationSent: true });
                console.log(`✅ Reminder sent for ${notification.contestName} to ${notification.userEmail}`);
            }
        }
    } catch (error) {
        console.error('❌ Error in cron job:', error);
    }
});

// Clean up old notifications (runs daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Cleaning up old notifications...');
    
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const snapshot = await Notification.where('contestStartTime', '<', yesterday).get();

        const batch = Notification.firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        console.log(`Cleaned up ${snapshot.docs.length} old notifications`);
    } catch (error) {
        console.error('Error cleaning up notifications:', error);
    }
});

module.exports = { sendContestNotification };