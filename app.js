require('dotenv').config();

const express = require('express');
const session = require('express-session');
const Path = require('path');

const app = express();

// Initialize Firebase (must happen before any routes/services that use db/auth)
require('./firebase');

// Routes
const authRoutes = require('./routes/auth');
const handleRoutes = require('./routes/handles');
const indexRoutes = require('./routes/index');
const notificationRoutes = require('./routes/notifications');

// Services
require('./services/notificationService');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(Path.join(__dirname, 'public')));

app.use(session({
    // FIX: session secret must come from .env, never hardcoded
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // set to true in production with HTTPS
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(authRoutes);
app.use(handleRoutes);
app.use(indexRoutes);
app.use(notificationRoutes);

// FIX: 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).send('404: Page Not Found');
});

// FIX: global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong.');
});

app.listen(3000, () => {
    console.log('Server running 👉 http://localhost:3000/');
});