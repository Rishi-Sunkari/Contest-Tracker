const express = require('express');
const router = express.Router();
const UserHandle = require('../handlesdata.js');
const { isAuthenticated } = require('../middleware/auth.js');

router.post('/handles', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const newHandles = req.body;

    try {
        const snapshot = await UserHandle.where('userid', '==', userId).get();

        if (!snapshot.empty) {
            let userHandleDoc;
            snapshot.forEach(doc => {
                userHandleDoc = doc;
            });

            const userHandle = userHandleDoc.data();
            const updatedData = {
                codeforces: newHandles.codeforces && newHandles.codeforces.trim() !== ''
                    ? newHandles.codeforces.trim()
                    : userHandle.codeforces,
                leetcode: newHandles.leetcode && newHandles.leetcode.trim() !== ''
                    ? newHandles.leetcode.trim()
                    : userHandle.leetcode,
                codechef: newHandles.codechef && newHandles.codechef.trim() !== ''
                    ? newHandles.codechef.trim()
                    : userHandle.codechef,
                atcoder: newHandles.atcoder && newHandles.atcoder.trim() !== ''
                    ? newHandles.atcoder.trim()
                    : userHandle.atcoder,
                tocoder: newHandles.tocoder && newHandles.tocoder.trim() !== ''
                    ? newHandles.tocoder.trim()
                    : userHandle.tocoder
            };

            await UserHandle.doc(userHandleDoc.id).update(updatedData);

            res.render('handles', { handles: updatedData });
        } else {
            const userHandle = {
                userid: userId,
                codeforces: newHandles.codeforces ? newHandles.codeforces.trim() : '',
                leetcode: newHandles.leetcode ? newHandles.leetcode.trim() : '',
                codechef: newHandles.codechef ? newHandles.codechef.trim() : '',
                atcoder: newHandles.atcoder ? newHandles.atcoder.trim() : '',
                tocoder: newHandles.tocoder ? newHandles.tocoder.trim() : ''
            };
            await UserHandle.add(userHandle);
            res.render('handles', { handles: userHandle });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error saving handles");
    }
});

router.get('/handles', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const snapshot = await UserHandle.where('userid', '==', userId).get();

        if (snapshot.empty) {
            return res.render("handles", { handles: {} });
        }

        let userHandle;
        snapshot.forEach(doc => {
            userHandle = doc.data();
        });

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

module.exports = router;