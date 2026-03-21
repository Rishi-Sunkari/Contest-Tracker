const mongoose = require('mongoose');

// Only connect if not already connected
if (mongoose.connection.readyState === 0) {
    mongoose.connect('mongodb://localhost:27017/contesttracking').then(() => {
        console.log("MongoDB connected successfully.");
    }).catch(err => {
        console.error("MongoDB connection error:", err);
    });
}

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String
});

module.exports = mongoose.model("User", userSchema);

