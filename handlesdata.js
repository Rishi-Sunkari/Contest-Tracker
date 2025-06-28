const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/youtubeharsh', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("MongoDB connected successfully.");
}).catch(err => {
    console.error("MongoDB connection error:", err);
});

const userSchema1 = new mongoose.Schema({
     userid: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    codeforces: String,
    leetcode: String,
    codechef : String,
    atcoder : String,
    tocoder: String
});

module.exports = mongoose.model("userhandle", userSchema1);



