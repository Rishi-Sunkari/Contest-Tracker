// FIX: import the already-initialized db from firebase.js
// instead of calling admin.firestore() directly (which crashes if firebase isn't initialized yet)
const { db } = require('./firebase');

const UserHandle = db.collection('userhandles');

module.exports = UserHandle;