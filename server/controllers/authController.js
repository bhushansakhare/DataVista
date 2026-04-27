import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });
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
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await user.compare(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    const workspace = user.workspaceId ? await Workspace.findById(user.workspaceId) : null;
    res.json({ token, user, workspace });
  } catch (err) {
    next(err);
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
