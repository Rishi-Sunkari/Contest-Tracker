const express = require('express');
const session = require('express-session');
const Path = require('path');
const model = require('./usermodel.js');
const usermodel = require('./handlesdata.js');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const mongoose = require('mongoose');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(Path.join(__dirname, "public")));

app.use(session({
    secret: 'frhtih#^#@#$@!%kfjtbchrwu',
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'rishi250904email@gmail.com',
        pass: process.env.EMAIL_PASS || 'Rishi@9912'
    }
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contestId: {
        type: String,
        required: true
    },
    contestName: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        required: true
    },
    contestStartTime: {
        type: Date,
        required: true
    },
    contestUrl: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model('Notification', notificationSchema);

const puppeteer = require('puppeteer');

async function getLeetCodeRating(username) {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        await page.goto(`https://leetcode.com/${username}/contest/`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.text-label-1.dark\\:text-dark-label-1.text-2xl', { timeout: 10000 });

        const rating = await page.evaluate(() => {
            const el = document.querySelector('.text-label-1.dark\\:text-dark-label-1.text-2xl');
            return el ? el.textContent.trim() : null;
        });

        await browser.close();
        return rating || "Unrated";
    } catch (error) {
        console.error("Error fetching LeetCode rating:", error.message);
        return "Error";
    }
}

async function getRatings(handles) {
    const results = {};

    // Codeforces (official API)
    if (handles.codeforces) {
        try {
            const res = await axios.get(`https://codeforces.com/api/user.info?handles=${handles.codeforces}`);
            results.codeforces = res.data.result[0].rating || "Unrated";
        } catch (err) {
            results.codeforces = "Error";
        }
    }

    // LeetCode (scraping)
    if (handles.leetcode) {
        results.leetcode = await getLeetCodeRating(handles.leetcode);
    }

    // CodeChef (scraping)
    if (handles.codechef) {
        try {
            const res = await axios.get(`https://www.codechef.com/users/${handles.codechef}`);
            const $ = cheerio.load(res.data);
            const rating = $(".rating-number").text().trim() || "Unrated";
            results.codechef = rating;
        } catch (err) {
            results.codechef = "Error";
        }
    }

    // AtCoder (scraping)
    if (handles.atcoder) {
        try {
            const res = await axios.get(`https://atcoder.jp/users/${handles.atcoder}`);
            const $ = cheerio.load(res.data);
            const ratingText = $("table tr:contains('Rating') td").first().text().trim();
            results.atcoder = ratingText || "Unrated";
        } catch (err) {
            results.atcoder = "Error";
        }
    }

    // ToCoder or TopCoder (unsupported)
    if (handles.tocoder) {
        results.tocoder = "Not supported yet";
    }

    return results;
}

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

// Improved Contest Scraper Function with Better Error Handling
const fetchAllContests = async () => {
    const contestsAll = [];
    const errors = [];

    // --- Codeforces ---
    try {
        console.log('Fetching Codeforces contests...');
        const cfResponse = await axios.get('https://codeforces.com/api/contest.list');
        const cfContests = cfResponse.data.result.filter(contest => 
            contest.phase === 'BEFORE' || contest.phase === 'CODING'
        );
        
        const formattedCF = cfContests.map(contest => {
            const start = new Date(contest.startTimeSeconds * 1000);
            const end = new Date((contest.startTimeSeconds + contest.durationSeconds) * 1000);
            return {
                platform: 'Codeforces',
                name: contest.name,
                startISO: start.toISOString(),
                endISO: end.toISOString(),
                duration: contest.durationSeconds / 60,
                startDisplay: start.toLocaleString(),
                endDisplay: end.toLocaleString(),
                url: `https://codeforces.com/contest/${contest.id}`
            };
        });
        
        contestsAll.push(...formattedCF);
        console.log(`✅ Codeforces: ${formattedCF.length} contests fetched`);
    } catch (error) {
        console.error('❌ Codeforces Error:', error.message);
        errors.push(`Codeforces: ${error.message}`);
    }

    // --- CodeChef ---
    try {
        console.log('Fetching CodeChef contests...');
        const ccResponse = await axios.get('https://www.codechef.com/api/list/contests/all');
        
        const ccContests = [
            ...(ccResponse.data.present_contests || []), 
            ...(ccResponse.data.future_contests || [])
        ];
        
        const formattedCC = ccContests.map(contest => ({
            platform: 'CodeChef',
            name: contest.contest_name,
            startISO: contest.contest_start_date_iso,
            endISO: contest.contest_end_date_iso,
            duration: contest.contest_duration,
            startDisplay: contest.contest_start_date,
            endDisplay: contest.contest_end_date,
            url: `https://www.codechef.com/${contest.contest_code}`
        }));
        
        contestsAll.push(...formattedCC);
        console.log(`✅ CodeChef: ${formattedCC.length} contests fetched`);
    } catch (error) {
        console.error('❌ CodeChef Error:', error.message);
        errors.push(`CodeChef: ${error.message}`);
    }

    // --- AtCoder ---
    try {
        console.log('Fetching AtCoder contests...');
        const atcoderResponse = await axios.get('https://atcoder.jp/contests/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $atcoder = cheerio.load(atcoderResponse.data);
        const upcomingContestsAtcoder = [];

        $atcoder('#contest-table-upcoming tbody tr').each((index, element) => {
            const tds = $atcoder(element).find('td');
            if (tds.length >= 3) {
                const timeText = $atcoder(tds[0]).text().trim();
                const name = $atcoder(tds[1]).text().trim();
                const url = 'https://atcoder.jp' + $atcoder(tds[1]).find('a').attr('href');
                const duration = $atcoder(tds[2]).text().trim();

                if (timeText && name && duration) {
                    try {
                        const startTime = new Date(timeText);
                        const durationParts = duration.split(':');
                        const durationMinutes = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
                        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

                        upcomingContestsAtcoder.push({
                            platform: 'AtCoder',
                            name,
                            startISO: startTime.toISOString(),
                            endISO: endTime.toISOString(),
                            duration: durationMinutes,
                            startDisplay: startTime.toLocaleString(),
                            endDisplay: endTime.toLocaleString(),
                            url
                        });
                    } catch (parseError) {
                        console.error('AtCoder parsing error for row:', timeText, name, duration);
                    }
                }
            }
        });
        
        contestsAll.push(...upcomingContestsAtcoder);
        console.log(`✅ AtCoder: ${upcomingContestsAtcoder.length} contests fetched`);
    } catch (error) {
        console.error('❌ AtCoder Error:', error.message);
        errors.push(`AtCoder: ${error.message}`);
    }

    // --- LeetCode ---
    try {
        console.log('Fetching LeetCode contests...');
        const leetcodeQuery = `
            query {
                allContests {
                    title
                    startTime
                    duration
                    titleSlug
                }
            }
        `;
        
        const leetcodeResponse = await axios.post('https://leetcode.com/graphql', 
            { query: leetcodeQuery },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            }
        );

        if (leetcodeResponse.data.errors) {
            throw new Error('GraphQL query failed: ' + JSON.stringify(leetcodeResponse.data.errors));
        }

        const now = new Date();
        const contests = leetcodeResponse.data.data?.allContests || [];

        const leetcodeFiltered = contests.filter(contest => {
            const start = new Date(contest.startTime * 1000);
            const end = new Date(start.getTime() + contest.duration * 1000);
            return now < end;
        });

        const formattedLC = leetcodeFiltered.map(contest => {
            const startTime = new Date(contest.startTime * 1000);
            const durationMinutes = contest.duration / 60;
            const endTime = new Date(startTime.getTime() + contest.duration * 1000);

            return {
                platform: 'LeetCode',
                name: contest.title,
                startISO: startTime.toISOString(),
                endISO: endTime.toISOString(),
                duration: durationMinutes,
                startDisplay: startTime.toLocaleString(),
                endDisplay: endTime.toLocaleString(),
                url: `https://leetcode.com/contest/${contest.titleSlug}/`
            };
        });
        
        contestsAll.push(...formattedLC);
        console.log(`✅ LeetCode: ${formattedLC.length} contests fetched`);
    } catch (error) {
        console.error('❌ LeetCode Error:', error.message);
        errors.push(`LeetCode: ${error.message}`);
    }

    console.log(`\n📊 SUMMARY: ${contestsAll.length} total contests fetched`);
    return contestsAll;
};

// Routes
app.get('/signup', (req, res) => {
    res.render("signup");
});

app.post('/signup', (req, res) => {
    model.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
    }).then(() => {
        res.redirect('/login');
    }).catch((err) => {
        console.log("Signup Error:", err);
        res.status(500).send("Error during signup");
    });
});

app.get('/login', (req, res) => {
    res.render("login");
});

app.post('/login', async (req, res) => {
    try {
        const user = await model.findOne({ email: req.body.email });

        if (user && user.password === req.body.password) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.status(401).send("Invalid email or password");
        }
    } catch (error) {
        console.log("Login error:", error);
        res.status(500).send("Internal server error");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Could not log out.");
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.get('/', isAuthenticated, async (req, res) => {
    const { _id: userId } = req.session.user;
    const allContests = await fetchAllContests();

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const now = new Date();

    const todaysContests = allContests.filter(contest => {
        const start = new Date(contest.startISO);
        return start >= startOfDay && start <= endOfDay;
    });

    const ongoingContests = allContests.filter(contest => {
        const start = new Date(contest.startISO);
        const end = new Date(contest.endISO);
        return start <= now && now <= end;
    });
    
    const userdata11 = await usermodel.findOne({ userid: userId });

    const handles = {
        codeforces: userdata11?.codeforces || '',
        leetcode: userdata11?.leetcode || '',
        codechef: userdata11?.codechef || '',
        atcoder: userdata11?.atcoder || '',
        tocoder: userdata11?.tocoder || ''
    };

    const results = await getRatings(handles);

    res.render("index", {
        contests: todaysContests,
        contests1: ongoingContests,
        results,
        handles
    });
});

app.get('/upcomingcontests', isAuthenticated, async (req, res) => {
    const allContests = await fetchAllContests();
    allContests.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));
    res.render("upcoming", { contests: allContests });
});

app.post('/handles', isAuthenticated, async (req, res) => {
    const userId = req.session.user._id;
    const newHandles = req.body; 

    try {
        let userHandle = await usermodel.findOne({ userid: userId });

        if (userHandle) {
            userHandle.codeforces = newHandles.codeforces && newHandles.codeforces.trim() !== ''
                ? newHandles.codeforces.trim()
                : userHandle.codeforces;

            userHandle.leetcode = newHandles.leetcode && newHandles.leetcode.trim() !== ''
                ? newHandles.leetcode.trim()
                : userHandle.leetcode;

            userHandle.codechef = newHandles.codechef && newHandles.codechef.trim() !== ''
                ? newHandles.codechef.trim()
                : userHandle.codechef;

            userHandle.atcoder = newHandles.atcoder && newHandles.atcoder.trim() !== ''
                ? newHandles.atcoder.trim()
                : userHandle.atcoder;

            userHandle.tocoder = newHandles.tocoder && newHandles.tocoder.trim() !== ''
                ? newHandles.tocoder.trim()
                : userHandle.tocoder;

            await userHandle.save();
        } else {
            userHandle = await usermodel.create({
                userid: userId,
                codeforces: newHandles.codeforces ? newHandles.codeforces.trim() : '',
                leetcode: newHandles.leetcode ? newHandles.leetcode.trim() : '',
                codechef: newHandles.codechef ? newHandles.codechef.trim() : '',
                atcoder: newHandles.atcoder ? newHandles.atcoder.trim() : '',
                tocoder: newHandles.tocoder ? newHandles.tocoder.trim() : ''
            });
        }

        res.render('handles', {
            handles: {
                codeforces: userHandle.codeforces,
                leetcode: userHandle.leetcode,
                codechef: userHandle.codechef,
                atcoder: userHandle.atcoder,
                tocoder: userHandle.tocoder
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error saving handles");
    }
});

app.get('/handles', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userHandle = await usermodel.findOne({ userid: userId });
        
        res.render("handles", {
            handles: userHandle ? {
                codeforces: userHandle.codeforces,
                leetcode: userHandle.leetcode,
                codechef: userHandle.codechef,
                atcoder: userHandle.atcoder,
                tocoder: userHandle.tocoder
            } : {}
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading handles");
    }
});

// API Route: Subscribe to contest notifications
         app.post('/subscribe-notification', isAuthenticated, async (req, res) => {
    try {
        const { contestId, contestName, platform, startTime, duration, contestUrl } = req.body;
        const userId = req.session.user._id;
        const userEmail = req.session.user.email;
        // Check if user already subscribed to this contest
        const existingNotification = await Notification.findOne({
            userId: userId,
            contestId: contestId
        });
        if (existingNotification) {
            return res.json({        
		success: false, 
                message: 'You are already subscribed to this contest!' 
            });
        }
        // Create new notification subscription
        const notification = new Notification({
            userId: userId,
            contestId: contestId,
            contestName: contestName,
            platform: platform,
            contestStartTime: new Date(startTime),
            contestUrl: contestUrl,
            userEmail: userEmail
        });
        await notification.save();
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
app.get('/my-notifications', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const notifications = await Notification.find({ 
            userId: userId,
            contestStartTime: { $gte: new Date() }
        }).sort({ contestStartTime: 1 });

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.json({ success: false, message: 'Error fetching notifications' });
    }
});

// API Route: Unsubscribe from contest notification
app.delete('/unsubscribe-notification/:contestId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const contestId = req.params.contestId;

        await Notification.deleteOne({ userId: userId, contestId: contestId });
        
        res.json({ 
            success: true, 
            message: 'Successfully unsubscribed from contest notifications' 
        });
    } catch (error) {
        console.error('Error unsubscribing:', error);
        res.json({ success: false, message: 'Error unsubscribing' });
    }
});

// Cron job to send email reminders (runs every 5 minutes to check for contests starting in 10 minutes)
cron.schedule('*/5 * * * *', async () => {
    console.log('🔔 Checking for contest reminders...');
    
    try {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() +   10 * 60 * 1000); // 10 minutes from now
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

        // Find contests starting between 5-10 minutes from now that haven't been notified
        const upcomingNotifications = await Notification.find({
            contestStartTime: {
                $gte: fiveMinutesFromNow,
                $lte: tenMinutesFromNow
            },
            notificationSent: false
        });

        console.log(`Found ${upcomingNotifications.length} upcoming contests to notify`);

        for (const notification of upcomingNotifications) {
            const emailData = {
                contestName: notification.contestName,
                platform: notification.platform,
                startTime: notification.contestStartTime.toLocaleString(),
                duration: 'Check contest page',
                contestUrl: notification.contestUrl
            };

            const emailSent = await sendContestNotification(notification.userEmail, emailData);
            
            if (emailSent) {
                // Mark as sent
                notification.notificationSent = true;
                await notification.save();
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

        const result = await Notification.deleteMany({
            contestStartTime: { $lt: yesterday }
        });

        console.log(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
        console.error('Error cleaning up notifications:', error);
    }
});

app.listen(3000, () => {
    console.log("The server is running on port 3000...  http://localhost:3000/");
});

module.exports = Notification;