// FIX: dotenv is already loaded in app.js — no need to call it again here
const admin = require('firebase-admin');

// --- BEGIN PRE-INITIALIZATION CHECKS ---

// Check for required Firebase credential environment variables.
const requiredEnv = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
];

const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(
        '🔥🔥🔥 Missing Firebase environment variables:',
        missingEnv.join(', ')
    );
    console.error(
        '🚨🚨🚨 Make sure your .env file is complete and all required Firebase credential fields are set.'
    );
    process.exit(1); // Exit if configuration is incomplete.
}

// --- END PRE-INITIALIZATION CHECKS ---


// FIX: NEVER commit your service account JSON to source control.
// Instead, store credentials as environment variables in .env (see .env.example).
// Option A (recommended for production): set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
//   and just call admin.initializeApp() with no arguments.
// Option B (used here): pass individual fields via env vars.

const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // .env stores the key with literal \n — replace to get real newlines
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
};

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error('🔥🔥🔥 Firebase Admin initialization error:', error.message);
    console.error('🚨🚨🚨 This can happen for a few reasons:');
    console.error('1. Your service account credentials in the .env file are incorrect (e.g., malformed private key).');
    console.error('2. The service account might be disabled or deleted.');
    console.error('Please double-check your .env file and Firebase project settings.');
    process.exit(1);
}


const db = admin.firestore();
const auth = admin.auth();

// Add a check to see if Firestore is accessible. This helps diagnose the '5 NOT_FOUND' error.
db.listCollections().then(collections => {
    if (collections.length === 0) {
        console.log("Firestore connection successful, but no collections found. This is normal for a new project.");
    } else {
        console.log("Firestore connection successful. Found collections.");
    }
}).catch(error => {
    if (error.code === 5) { // Specific check for 'NOT_FOUND'
        console.error('🔥🔥🔥 Firestore connection failed with a "NOT_FOUND" error.');
        console.error('🚨🚨🚨 This almost always means you have not created a Firestore database in your Firebase project yet.');
        console.error('➡️ FIX: Go to your Firebase project console, navigate to "Firestore Database", and click "Create database".');
    } else {
        console.error('🔥🔥🔥 An unexpected error occurred when trying to connect to Firestore:', error);
    }
    // We don't exit here, but the error will prevent the app from functioning correctly.
});


module.exports = { admin, db, auth };