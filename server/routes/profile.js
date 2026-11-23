// FE-10 profile initialization: all Firestore access stays behind verified auth.
const express = require('express');
const { getApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const router = express.Router();

// POST /api/profile is idempotent: repeated sign-ins preserve preferences/timestamps.
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => key !== 'displayName')
      || (body.displayName !== undefined
        && (typeof body.displayName !== 'string' || body.displayName.trim().length > 100))) {
      return res.status(400).json({ error: {
        code: 'INVALID_PROFILE', message: 'Provide only an optional display name of up to 100 characters.',
      } });
    }

    // Email and UID come exclusively from BE-03, never the request body.
    const db = getFirestore(getApp());
    const ref = db.collection('users').doc(req.user.uid);
    const created = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return false;
      transaction.create(ref, {
        displayName: body.displayName?.trim() || '',
        email: req.user.email || '',
        companionStyle: 'casual',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    return res.status(created ? 201 : 200).json({ profileReady: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
