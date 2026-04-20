const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin. Check if serviceAccountKey.json exists:', error.message);
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/delete-user', async (req, res) => {
    const { uid } = req.body;
    
    if (!uid) {
        return res.status(400).send({ error: 'UID is required' });
    }
    
    try {
        await admin.auth().deleteUser(uid);
        console.log(`Successfully deleted user ${uid} from Auth`);
        res.status(200).send({ success: true, message: 'User deleted from Auth' });
    } catch (error) {
        console.error('Error deleting user from Auth:', error);
        res.status(500).send({ error: 'Failed to delete user from Auth', details: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
