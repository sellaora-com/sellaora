const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Team = require('../models/Team');
const TeamMembership = require('../models/TeamMembership');
const TeamInvite = require('../models/TeamInvite');
const User = require('../models/User');

const router = express.Router();

// Helpers
const toSlug = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const isOwnerOrAdmin = async (teamId, userId) => {
  const m = await TeamMembership.findOne({ teamId, userId });
  return !!m && (m.role === 'owner' || m.role === 'admin');
};

// Create a team
// POST /api/teams
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    let slugBase = toSlug(name);
    if (!slugBase) slugBase = `team-${Date.now()}`;
    let slug = slugBase;
    let i = 1;
    while (await Team.findOne({ slug })) {
      slug = `${slugBase}-${i++}`;
    }

    const team = await Team.create({ name, slug, ownerId: req.user._id });
    await TeamMembership.create({ teamId: team._id, userId: req.user._id, role: 'owner' });

    res.status(201).json({ success: true, data: { team } });
  } catch (err) {
    console.error('Create team error:', err);
    res.status(500).json({ success: false, message: 'Server error creating team' });
  }
});


// List my teams
// GET /api/teams/my
router.get('/my', auth, async (req, res) => {
  try {
    const memberships = await TeamMembership.find({ userId: req.user._id }).lean();
    const teamIds = memberships.map(m => m.teamId);
    const teams = await Team.find({ _id: { $in: teamIds } }).lean();
    const byId = Object.fromEntries(teams.map(t => [String(t._id), t]));

    const result = memberships.map(m => ({
      team: byId[String(m.teamId)],
      role: m.role,
    }));

    res.json({ success: true, data: { teams: result } });
  } catch (err) {
    console.error('List my teams error:', err);
    res.status(500).json({ success: false, message: 'Server error listing teams' });
  }
});

// List members of a team
// GET /api/teams/:teamId/members
router.get('/:teamId/members', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return res.status(400).json({ success: false, message: 'Invalid teamId' });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    // Ensure user is a member
    const me = await TeamMembership.findOne({ teamId, userId: req.user._id });
    if (!me) return res.status(403).json({ success: false, message: 'Forbidden' });

    const members = await TeamMembership.find({ teamId }).lean();
    const userIds = members.map(m => m.userId);
    const users = await User.find({ _id: { $in: userIds } }, 'name email').lean();
    const usersById = Object.fromEntries(users.map(u => [String(u._id), u]));

    const data = members.map(m => ({
      user: usersById[String(m.userId)],
      userId: m.userId,
      role: m.role,
      mfaEnabled: m.mfaEnabled,
      isYou: String(m.userId) === String(req.user._id)
    }));

    res.json({ success: true, data: { team, members: data } });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ success: false, message: 'Server error listing members' });
  }
});

// Invite a member by email
// POST /api/teams/:teamId/invites { email, role }
router.post('/:teamId/invites', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    // Must be admin or owner
    const me = await TeamMembership.findOne({ teamId, userId: req.user._id });
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Only owner or admin can invite' });
    }

    const token = TeamInvite.generateToken();
    const invite = await TeamInvite.create({ teamId, email: email.toLowerCase(), role: role === 'admin' ? 'admin' : 'member', token, invitedBy: req.user._id });

    // In a real app, send email here; return token for development
    res.status(201).json({ success: true, data: { invite: { id: invite._id, email: invite.email, role: invite.role, token: invite.token, expiresAt: invite.expiresAt } } });
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ success: false, message: 'Server error creating invite' });
  }
});

// Accept invite
// POST /api/teams/invites/accept { token }
router.post('/invites/accept', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const invite = await TeamInvite.findOne({ token });
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    if (invite.acceptedAt) return res.status(400).json({ success: false, message: 'Invite already accepted' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Invite expired' });

    // If the invited email matches the user's email (recommended), or allow any user for dev
    const user = await User.findById(req.user._id);
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'This invite was issued to a different email' });
    }

    // Create membership if not exists
    const existing = await TeamMembership.findOne({ teamId: invite.teamId, userId: req.user._id });
    if (!existing) {
      await TeamMembership.create({ teamId: invite.teamId, userId: req.user._id, role: invite.role });
    }

    invite.acceptedAt = new Date();
    await invite.save();

    res.json({ success: true, message: 'Invite accepted' });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ success: false, message: 'Server error accepting invite' });
  }
});

// Update member role/MFA
// PUT /api/teams/:teamId/members/:userId { role?, mfaEnabled? }
router.put('/:teamId/members/:userId', auth, async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const { role, mfaEnabled } = req.body;

    const me = await TeamMembership.findOne({ teamId, userId: req.user._id });
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Only owner or admin can update members' });
    }

    const membership = await TeamMembership.findOne({ teamId, userId });
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });

    if (role) {
      if (!['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      // Prevent demoting the last owner
      if (membership.role === 'owner' && role !== 'owner') {
        const ownerCount = await TeamMembership.countDocuments({ teamId, role: 'owner' });
        if (ownerCount <= 1) {
          return res.status(400).json({ success: false, message: 'Cannot demote the last owner' });
        }
      }
      membership.role = role;
    }

    if (typeof mfaEnabled === 'boolean') {
      membership.mfaEnabled = mfaEnabled;
    }

    await membership.save();

    res.json({ success: true, data: { membership } });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ success: false, message: 'Server error updating member' });
  }
});

// Remove member or leave team
// DELETE /api/teams/:teamId/members/:userId
router.delete('/:teamId/members/:userId', auth, async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    const me = await TeamMembership.findOne({ teamId, userId: req.user._id });
    if (!me) return res.status(403).json({ success: false, message: 'Forbidden' });

    const removingSelf = String(req.user._id) === String(userId);

    if (!removingSelf && !(me.role === 'owner' || me.role === 'admin')) {
      return res.status(403).json({ success: false, message: 'Only owner or admin can remove members' });
    }

    const membership = await TeamMembership.findOne({ teamId, userId });
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });

    if (membership.role === 'owner') {
      const ownerCount = await TeamMembership.countDocuments({ teamId, role: 'owner' });
      if (ownerCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot remove the last owner' });
      }
    }

    await TeamMembership.deleteOne({ _id: membership._id });

    res.json({ success: true, message: removingSelf ? 'Left team' : 'Member removed' });
  } catch (err) {
    console.error('Remove/Leave team error:', err);
    res.status(500).json({ success: false, message: 'Server error removing member' });
  }
});

// Get a team by id
// GET /api/teams/:teamId
router.get('/:teamId', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return res.status(400).json({ success: false, message: 'Invalid teamId' });

    const team = await Team.findById(teamId).lean();
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const me = await TeamMembership.findOne({ teamId, userId: req.user._id });
    if (!me) return res.status(403).json({ success: false, message: 'Forbidden' });

    res.json({ success: true, data: { team } });
  } catch (err) {
    console.error('Get team error:', err);
    res.status(500).json({ success: false, message: 'Server error getting team' });
  }
});

// Update team details/settings
// PUT /api/teams/:teamId
router.put('/:teamId', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return res.status(400).json({ success: false, message: 'Invalid teamId' });

    if (!(await isOwnerOrAdmin(teamId, req.user._id))) {
      return res.status(403).json({ success: false, message: 'Only owner or admin can update team' });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const updates = {};
    const { name, slug, settings } = req.body;

    if (typeof name === 'string' && name.trim()) updates.name = name.trim();

    if (typeof slug === 'string' && slug.trim()) {
      const slugCandidate = toSlug(slug.trim());
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugCandidate)) {
        return res.status(400).json({ success: false, message: 'Invalid slug format' });
      }
      const exists = await Team.findOne({ slug: slugCandidate, _id: { $ne: teamId } });
      if (exists) return res.status(409).json({ success: false, message: 'Slug already in use' });
      updates.slug = slugCandidate;
    }

    if (settings && typeof settings === 'object') {
      const next = { ...(team.settings || {}) };
      if (settings.assistantOptIn) {
        const level = String(settings.assistantOptIn);
        const allowed = ['disabled', 'schema_only', 'schema_logs'];
        if (!allowed.includes(level)) return res.status(400).json({ success: false, message: 'Invalid assistantOptIn' });
        next.assistantOptIn = level;
      }
      updates.settings = next;
    }

    Object.assign(team, updates);
    await team.save();

    res.json({ success: true, data: { team } });
  } catch (err) {
    console.error('Update team error:', err);
    res.status(500).json({ success: false, message: 'Server error updating team' });
  }
});

module.exports = router;
