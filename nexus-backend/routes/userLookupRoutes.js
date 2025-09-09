import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.post('/users/lookup', async (req, res) => {
  try {
    const { identifiers } = req.body; // identifiers = array of emails/usernames

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({ message: 'Identifiers array is required' });
    }

    // Convert all to lowercase for case-insensitive search
    const lowered = identifiers.map(id => id.toLowerCase());

    // Find users where email or username is in identifiers
    const users = await User.find({
      $or: [
        { email: { $in: lowered } },
        { username: { $in: lowered } }
      ]
    }).select('_id email username');

    res.json({ users });
  } catch (error) {
    console.error('User lookup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
