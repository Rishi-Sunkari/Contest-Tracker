const express = require('express');
const router = express.Router();
const User = require('../usermodel.js');
const bcrypt = require('bcrypt');

const saltRounds = 10;

router.get('/signup', (req, res) => {
    res.render("signup");
});

router.post('/signup', async (req, res) => {
    try {
        const existingUserSnapshot = await User.where('email', '==', req.body.email).get();
        if (!existingUserSnapshot.empty) {
            return res.status(400).send('A user with this email already exists.');
        }

        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

        await User.add({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        });
        res.redirect('/login');
    } catch (err) {
       console.error("Signup Error:", err);
       res.status(500).send("An error occurred during signup.");
    }
});

router.get('/login', (req, res) => {
    res.render("login");
});

router.post('/login', async (req, res) => {
    try {
        const snapshot = await User.where('email', '==', req.body.email).get();
        if (snapshot.empty) {
            return res.status(401).send("Invalid email or password");
        }

        let user;
        snapshot.forEach(doc => {
            user = { id: doc.id, ...doc.data() };
        });

        const passwordMatch = await bcrypt.compare(req.body.password, user.password);

        if (user && passwordMatch) {
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

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Could not log out.");
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;