const express = require('express');
const router = express.Router();
const UserHandle = require('../handlesdata.js');
const { isAuthenticated } = require('../middleware/auth.js');
const { fetchAllContests } = require('../services/contestService.js');
const { getRatings } = require('../services/ratingService.js');

router.get('/', isAuthenticated, async (req, res) => {
    const { id: userId } = req.session.user;
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
    
    const snapshot = await UserHandle.where('userid', '==', userId).get();
    let userdata11 = {};
    if (!snapshot.empty) {
        snapshot.forEach(doc => {
            userdata11 = doc.data();
        });
    }

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

router.get('/upcomingcontests', isAuthenticated, async (req, res) => {
    const allContests = await fetchAllContests();
    allContests.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));
    res.render("upcoming", { contests: allContests });
});

module.exports = router;