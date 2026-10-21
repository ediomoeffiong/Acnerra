import { Response } from 'express';
import { z } from 'zod';
import { PartnerRelation, PartnerMode, PartnerStatus } from '../models/PartnerRelation';
import { User } from '../models/User';
import { createNotification } from '../lib/notifications';
import { Notification } from '../models/Notification';
import { Task, TaskVisibility } from '../models/Task';

const PartnerInviteSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20).trim(),
  mode: z.nativeEnum(PartnerMode),
});
const escapeRegex = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const getPartners = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const userId = req.user.userId;

    // Fetch all partner relations for this user
    const relations = await PartnerRelation.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
      .populate('senderId', 'id username name bio image')
      .populate('receiverId', 'id username name bio image')
      .sort({ createdAt: -1 });

    return res.status(200).json({ relations });
  } catch (error) {
    console.error('Get partners error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving partners.' });
  }
};

export const sendPartnerInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const parsed = PartnerInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const { username, mode } = parsed.data;
  const senderId = req.user.userId;

  try {
    const receiver = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
    if (!receiver) {
      return res.status(404).json({ message: 'No user found with that username.' });
    }

    if (receiver._id.toString() === senderId) {
      return res.status(400).json({ message: 'You cannot invite yourself as a partner.' });
    }

    // Check if an active/pending relationship already exists between the two users
    const duplicate = await PartnerRelation.findOne({
      $or: [
        { senderId, receiverId: receiver._id },
        { senderId: receiver._id, receiverId: senderId }
      ],
      status: { $in: [PartnerStatus.PENDING, PartnerStatus.ACCEPTED] }
    });

    if (duplicate) {
      if (duplicate.status === PartnerStatus.ACCEPTED) {
        return res.status(409).json({ message: 'You are already partners with this user.' });
      } else {
        return res.status(409).json({ message: 'A pending partner invitation already exists with this user.' });
      }
    }

    const partnerRelation = await PartnerRelation.create({
      senderId,
      receiverId: receiver._id,
      mode,
      status: PartnerStatus.PENDING
    });

    // Create notification for receiver
    const modeLabel = mode === PartnerMode.MUTUAL ? 'Mutual Partner' : 'Single Partner';
    const explanation = mode === PartnerMode.MUTUAL
      ? 'you can support each other, but only on tasks each person explicitly shares'
      : `you are being asked to monitor @${(await User.findById(senderId).select('username'))?.username || 'this user'}; their private tasks remain private`;

    await createNotification({
      userId: receiver._id,
      type: 'PARTNER_INVITE_RECEIVED',
      title: 'New Partner Invitation',
      message: `@${req.user.username} invited you to be a ${modeLabel} (${explanation}).`,
      partnerRelationId: partnerRelation._id,
    });

    await partnerRelation.populate([
      { path: 'senderId', select: 'id username name image' },
      { path: 'receiverId', select: 'id username name image' }
    ]);

    return res.status(201).json({
      message: 'Partner invitation sent successfully.',
      relation: partnerRelation.toJSON()
    });
  } catch (error) {
    console.error('Send partner invite error:', error);
    return res.status(500).json({ message: 'An error occurred while sending the partner invitation.' });
  }
};

export const acceptPartnerInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const { id } = req.params;

  try {
    const relation = await PartnerRelation.findById(id);
    if (!relation) {
      return res.status(404).json({ message: 'Partner invitation not found.' });
    }

    if (relation.receiverId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the invited user can accept this invitation.' });
    }

    if (relation.status !== PartnerStatus.PENDING) {
      return res.status(400).json({ message: `This invitation has already been ${relation.status.toLowerCase()}.` });
    }

    // Accept relation
    relation.status = PartnerStatus.ACCEPTED;
    relation.respondedAt = new Date();
    await relation.save();

    // Synchronize User accountabilityPartners lists
    const sender = await User.findById(relation.senderId);
    const receiver = await User.findById(relation.receiverId);

    if (sender && receiver) {
      sender.accountabilityPartners = sender.accountabilityPartners || [];
      receiver.accountabilityPartners = receiver.accountabilityPartners || [];

      if (relation.mode === PartnerMode.MUTUAL) {
        // Mutual: both monitor each other
        if (!sender.accountabilityPartners.includes(receiver._id as any)) {
          sender.accountabilityPartners.push(receiver._id as any);
        }
        if (!receiver.accountabilityPartners.includes(sender._id as any)) {
          receiver.accountabilityPartners.push(sender._id as any);
        }
      } else if (relation.mode === PartnerMode.SINGLE) {
        // Single: receiver monitors sender
        if (!sender.accountabilityPartners.includes(receiver._id as any)) {
          sender.accountabilityPartners.push(receiver._id as any);
        }
      }
      await sender.save();
      await receiver.save();
    }

    // Delete or mark read the original invitation notifications
    await Notification.updateMany(
      { partnerRelationId: relation._id },
      { $set: { read: true } }
    );

    // Notify the sender that the invitation was accepted
    const modeLabel = relation.mode === PartnerMode.MUTUAL ? 'mutual' : 'single';
    await createNotification({
      userId: relation.senderId,
      type: 'PARTNER_INVITE_ACCEPTED',
      title: 'Partner Invitation Accepted',
      message: `@${req.user.username} accepted your invitation to be a ${modeLabel} partner.`,
      partnerRelationId: relation._id
    });

    await relation.populate([
      { path: 'senderId', select: 'id username name image' },
      { path: 'receiverId', select: 'id username name image' }
    ]);

    return res.status(200).json({
      message: 'Partner invitation accepted successfully.',
      relation: relation.toJSON()
    });
  } catch (error) {
    console.error('Accept partner invite error:', error);
    return res.status(500).json({ message: 'An error occurred while accepting the partner invitation.' });
  }
};

export const declinePartnerInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const { id } = req.params;

  try {
    const relation = await PartnerRelation.findById(id);
    if (!relation) {
      return res.status(404).json({ message: 'Partner invitation not found.' });
    }

    if (relation.receiverId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the invited user can decline this invitation.' });
    }

    if (relation.status !== PartnerStatus.PENDING) {
      return res.status(400).json({ message: `This invitation has already been ${relation.status.toLowerCase()}.` });
    }

    relation.status = PartnerStatus.DECLINED;
    relation.respondedAt = new Date();
    await relation.save();

    // Mark notifications read
    await Notification.updateMany(
      { partnerRelationId: relation._id },
      { $set: { read: true } }
    );

    return res.status(200).json({
      message: 'Partner invitation declined.',
      relation: relation.toJSON()
    });
  } catch (error) {
    console.error('Decline partner invite error:', error);
    return res.status(500).json({ message: 'An error occurred while declining the partner invitation.' });
  }
};

export const removePartner = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const { partnerId } = req.params; // this is the relation ID or the target partner ID
  const userId = req.user.userId;

  try {
    // Find the accepted relationship
    const relation = await PartnerRelation.findOne({
      _id: partnerId,
      status: { $in: [PartnerStatus.PENDING, PartnerStatus.ACCEPTED] },
      $or: [{ senderId: userId }, { receiverId: userId }]
    });

    if (!relation) {
      return res.status(404).json({ message: 'Partner relationship not found.' });
    }

    if (relation.status === PartnerStatus.PENDING && relation.senderId.toString() !== userId) {
      return res.status(403).json({ message: 'Only the sender can cancel a pending invitation.' });
    }

    // Pull from users' accountabilityPartners arrays
    const sender = await User.findById(relation.senderId);
    const receiver = await User.findById(relation.receiverId);

    if (sender && receiver) {
      sender.accountabilityPartners = (sender.accountabilityPartners || []).filter(
        id => id.toString() !== receiver._id.toString()
      );
      receiver.accountabilityPartners = (receiver.accountabilityPartners || []).filter(
        id => id.toString() !== sender._id.toString()
      );
      await sender.save();
      await receiver.save();
    }

    if (relation.status === PartnerStatus.ACCEPTED) {
      const senderId = relation.senderId.toString();
      const receiverId = relation.receiverId.toString();
      await Task.updateMany(
        { $or: [{ ownerId: senderId }, { ownerId: null, creatorId: senderId }] },
        { $pull: { sharedWithIds: receiverId, collaboratorIds: receiverId }, $set: { partnerId: null } }
      );
      if (relation.mode === PartnerMode.MUTUAL) {
        await Task.updateMany(
          { $or: [{ ownerId: receiverId }, { ownerId: null, creatorId: receiverId }] },
          { $pull: { sharedWithIds: senderId, collaboratorIds: senderId }, $set: { partnerId: null } }
        );
      }
      await Task.updateMany(
        { visibility: TaskVisibility.SELECTED_PARTNERS, sharedWithIds: { $size: 0 } },
        { $set: { visibility: TaskVisibility.PRIVATE, isPrivate: true } }
      );
      relation.status = PartnerStatus.TERMINATED;
      relation.terminatedAt = new Date();
      relation.terminatedBy = userId as any;
    } else {
      relation.status = PartnerStatus.CANCELLED;
      relation.respondedAt = new Date();
    }
    await relation.save();

    return res.status(200).json({
      message: relation.status === PartnerStatus.TERMINATED ? 'Partner relationship ended and relationship-derived task access revoked.' : 'Partner invitation cancelled.',
      partnerId
    });
  } catch (error) {
    console.error('Remove partner error:', error);
    return res.status(500).json({ message: 'An error occurred while removing the partner.' });
  }
};
