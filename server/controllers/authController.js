import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('Server misconfigured: JWT_SECRET missing');
    err.status = 500;
    throw err;
  }
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password, workspaceName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password are required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'superadmin' : 'admin';

    const user = await User.create({ name, email, password, role });
    const ws = await Workspace.create({
      name: workspaceName || `${name}'s workspace`,
      ownerId: user._id,
    });
    user.workspaceId = ws._id;
    await user.save();

    const token = signToken(user);
    res.status(201).json({ token, user, workspace: ws });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, user.password);
    } catch {
      ok = false;
    }
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId).catch(() => null);
    }

    return res.json({ token, user, workspace });
  } catch (err) {
    console.error('[login]', err);
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const workspace = req.user.workspaceId ? await Workspace.findById(req.user.workspaceId) : null;
    res.json({ user: req.user, workspace });
  } catch (err) {
    next(err);
  }
}
