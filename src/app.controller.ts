import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { Capture } from './schemas/capture.schema';
import { AiUsage } from './usage/usage.schema';
import { PiCommand } from './schemas/pi-command.schema';

@Controller()
export class AppController {
  private readonly rareSpecies = new Set([
    'visayan spotted deer',
    'philippine eagle',
    'tamaraw',
    'pangolin',
  ]);
  private readonly conservationSpecies = [
    {
      id: 'visayan-spotted-deer',
      commonName: 'Visayan Spotted Deer',
      scientificName: 'Rusa alfredi',
      category: 'Mammal',
      conservationStatus: 'Endangered',
      iucnStatus: 'EN',
      endemicRegion: 'Philippines',
      image: 'assets/visayan_spotted_deer.jpg',
    },
    {
      id: 'philippine-hornbill',
      commonName: 'Philippine Hornbill',
      scientificName: 'Buceros hydrocorax',
      category: 'Bird',
      conservationStatus: 'Endangered',
      iucnStatus: 'EN',
      endemicRegion: 'Philippines',
      image: 'assets/philippine_hornbill.jpg',
    },
    {
      id: 'visayan-warty-pig',
      commonName: 'Visayan Warty Pig',
      scientificName: 'Sus cebifrons',
      category: 'Mammal',
      conservationStatus: 'Critically Endangered',
      iucnStatus: 'CR',
      endemicRegion: 'Philippines',
      image: 'assets/visayan_warty_pig.jpg',
    },
  ];

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Capture.name)
    private readonly captureModel: Model<Capture>,
    @InjectModel(AiUsage.name)
    private readonly usageModel: Model<AiUsage>,
    @InjectModel(PiCommand.name)
    private readonly piCommandModel: Model<PiCommand>,
  ) {}

  @Post('pi/:deviceId/commands')
  async queuePiCommand(
    @Param('deviceId') deviceId: string,
    @Body('command') command?: string,
    @Body('payload') payload?: Record<string, any>,
    @Body('ttlSeconds') ttlSeconds?: number,
  ) {
    const normalizedDeviceId = (deviceId ?? '').trim();
    const normalizedCommand = (command ?? '').trim().toLowerCase();
    const allowedCommands = new Set(['capture_now']);

    if (!normalizedDeviceId) {
      throw new BadRequestException('deviceId is required');
    }
    if (!allowedCommands.has(normalizedCommand)) {
      throw new BadRequestException(
        'command must be one of: capture_now',
      );
    }

    const parsedTtl = Math.min(Math.max(Number(ttlSeconds) || 30, 5), 300);
    const expiresAt = new Date(Date.now() + parsedTtl * 1000);

    const created = await this.piCommandModel.create({
      device_id: normalizedDeviceId,
      command: normalizedCommand,
      payload: payload ?? {},
      status: 'queued',
      expires_at: expiresAt,
    });

    return {
      id: String(created._id),
      deviceId: created.device_id,
      command: created.command,
      status: created.status,
      expiresAt: created.expires_at,
      message: 'Command queued',
    };
  }

  @Get('pi/:deviceId/commands/next')
  async nextPiCommand(
    @Param('deviceId') deviceId: string,
    @Headers('x-device-key') deviceKey?: string,
  ) {
    if (!deviceKey || deviceKey !== process.env.DEVICE_MASTER_SECRET) {
      throw new UnauthorizedException('Invalid device key');
    }

    const now = new Date();
    await this.piCommandModel.updateMany(
      {
        device_id: deviceId,
        status: { $in: ['queued', 'sent'] },
        expires_at: { $lte: now },
      },
      { $set: { status: 'expired' } },
    );

    const command = await this.piCommandModel.findOneAndUpdate(
      {
        device_id: deviceId,
        status: 'queued',
        expires_at: { $gt: now },
      },
      {
        $set: {
          status: 'sent',
          sent_at: now,
        },
      },
      {
        sort: { createdAt: 1 },
        returnDocument: 'after',
      },
    );

    if (!command) {
      return { command: null };
    }

    return {
      command: {
        id: String(command._id),
        deviceId: command.device_id,
        name: command.command,
        payload: command.payload ?? {},
        sentAt: command.sent_at ?? command.updatedAt,
        expiresAt: command.expires_at,
      },
    };
  }

  @Patch('pi/:deviceId/commands/:id/ack')
  async acknowledgePiCommand(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @Body('status') status?: string,
    @Body('message') message?: string,
    @Headers('x-device-key') deviceKey?: string,
  ) {
    if (!deviceKey || deviceKey !== process.env.DEVICE_MASTER_SECRET) {
      throw new UnauthorizedException('Invalid device key');
    }

    const normalizedStatus = (status ?? '').trim().toLowerCase();
    if (!['executed', 'failed'].includes(normalizedStatus)) {
      throw new BadRequestException('status must be one of: executed, failed');
    }

    const command = await this.piCommandModel.findOne({
      _id: id,
      device_id: deviceId,
    });
    if (!command) {
      throw new NotFoundException('Command not found');
    }

    command.status = normalizedStatus as 'executed' | 'failed';
    command.acknowledged_at = new Date();
    command.message = (message ?? '').trim() || undefined;
    await command.save();

    return {
      id: String(command._id),
      deviceId: command.device_id,
      status: command.status,
      acknowledgedAt: command.acknowledged_at,
      message: command.message ?? null,
    };
  }

  @Get('health')
  health() {
    const memory = process.memoryUsage();

    const mongoStateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
      database: mongoStateMap[this.connection.readyState],
    };
  }

  @Get('metrics')
  async metrics() {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);

    const totalToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const approvedToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      status: 'approved',
    });

    const discardedToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      status: 'discard',
    });
    const alertsToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      should_alert: true,
    });
    const unusualToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      is_unusual: true,
    });

    const usage = await this.usageModel.findOne({ date: today });

    return {
      date: today,
      captures: {
        total: totalToday,
        approved: approvedToday,
        discarded: discardedToday,
        alerts: alertsToday,
        unusual: unusualToday,
      },
      ai_usage: {
        used: usage?.count ?? 0,
        limit: usage?.limit ?? 0,
      },
      memory: process.memoryUsage().heapUsed,
    };
  }

  @Get('reports/daily')
  async dailyReport(@Query('date') date?: string) {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    const [
      totalCaptures,
      alerts,
      unusual,
      topSpecies,
      rareDetections,
      suspiciousHumanAtNight,
      peakHour,
    ] = await Promise.all([
      this.captureModel.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      this.captureModel.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        should_alert: true,
      }),
      this.captureModel.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        is_unusual: true,
      }),
      this.captureModel.aggregate([
        { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: '$species', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      this.captureModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            species: { $in: Array.from(this.rareSpecies) },
          },
        },
        { $group: { _id: '$species', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.captureModel.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        species: 'person',
        is_night: true,
      }),
      this.captureModel.aggregate([
        { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const topSpeciesName = topSpecies[0]?._id ?? null;
    const topSpeciesCount = topSpecies[0]?.count ?? 0;
    const peakActivityHour = peakHour[0]?._id ?? null;
    const peakHourCount = peakHour[0]?.count ?? 0;

    const summary = [
      `Daily Wildlife Report - ${targetDate}`,
      `Total Captures: ${totalCaptures}`,
      `Alerts Triggered: ${alerts}`,
      `Unusual Events: ${unusual}`,
      `Most Frequent Species: ${topSpeciesName ?? 'n/a'} (${topSpeciesCount})`,
      `Rare Detections: ${rareDetections.length > 0 ? 'yes' : 'none'}`,
      `Suspicious Activity (human at night): ${suspiciousHumanAtNight}`,
      `Peak Activity Hour: ${peakActivityHour ?? 'n/a'}:00 (${peakHourCount})`,
    ].join('\n');

    return {
      date: targetDate,
      totals: {
        captures: totalCaptures,
        alerts,
        unusual,
      },
      top_species: topSpecies.map((item) => ({
        species: item._id,
        count: item.count,
      })),
      rare_detections: rareDetections.map((item) => ({
        species: item._id,
        count: item.count,
      })),
      suspicious_activity: {
        human_at_night: suspiciousHumanAtNight,
      },
      peak_activity: peakActivityHour === null
        ? null
        : {
            hour_utc: peakActivityHour,
            count: peakHourCount,
          },
      summary,
    };
  }

  @Get('images')
  async images(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const captures = await this.captureModel
      .find(
        {
          image_url: { $exists: true, $ne: '' },
          status: 'approved',
        },
        {
          image_url: 1,
          createdAt: 1,
          captured_at: 1,
          species: 1,
          confidence: 1,
          ai_summary: 1,
          status: 1,
          zone_id: 1,
          risk_score: 1,
          risk_reasons: 1,
          should_alert: 1,
          priority: 1,
        },
      )
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    return captures.map((capture) => ({
      id: String(capture._id),
      url: capture.image_url,
      createdAt: capture.createdAt,
      capturedAt: capture.captured_at ?? capture.createdAt,
      species: capture.species,
      confidence: capture.confidence,
      aiSummary: capture.ai_summary ?? null,
      status: capture.status,
      zoneId: capture.zone_id ?? null,
      riskScore: capture.risk_score ?? 0,
      riskReasons: capture.risk_reasons ?? [],
      shouldAlert: Boolean(capture.should_alert),
      priority: capture.priority ?? 'low',
    }));
  }

  @Get('alerts')
  async alerts(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);

    const captures = await this.captureModel
      .find(
        { should_alert: true },
        {
          image_url: 1,
          createdAt: 1,
          captured_at: 1,
          species: 1,
          confidence: 1,
          ai_summary: 1,
          zone_id: 1,
          risk_score: 1,
          risk_reasons: 1,
          priority: 1,
        },
      )
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    return captures.map((capture) => ({
      id: String(capture._id),
      url: capture.image_url,
      createdAt: capture.createdAt,
      capturedAt: capture.captured_at ?? capture.createdAt,
      species: capture.species,
      confidence: capture.confidence,
      aiSummary: capture.ai_summary ?? null,
      zoneId: capture.zone_id ?? null,
      riskScore: capture.risk_score ?? 0,
      riskReasons: capture.risk_reasons ?? [],
      priority: capture.priority ?? 'low',
    }));
  }

  @Get('needs-review')
  async needsReview(
    @Query('limit') limit?: string,
    @Query('species') species?: string,
    @Query('priority') priority?: string,
    @Query('zoneId') zoneId?: string,
    @Query('reason') reason?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const parsedPriority = (priority ?? '').trim().toLowerCase();
    const parsedSortBy = (sortBy ?? 'createdAt').trim();
    const parsedOrder = (order ?? 'desc').trim().toLowerCase();
    const sortDirection = parsedOrder === 'asc' ? 1 : -1;

    const filter: any = { status: 'needs_review' };
    if (species?.trim()) {
      filter.species = { $regex: species.trim(), $options: 'i' };
    }
    if (parsedPriority) {
      filter.priority = parsedPriority;
    }
    if (zoneId?.trim()) {
      filter.zone_id = { $regex: zoneId.trim(), $options: 'i' };
    }
    if (reason?.trim()) {
      filter.risk_reasons = {
        $elemMatch: { $regex: reason.trim(), $options: 'i' },
      };
    }

    const sortFieldMap: Record<string, string> = {
      createdAt: 'createdAt',
      riskScore: 'risk_score',
      priority: 'priority',
    };
    const sortField = sortFieldMap[parsedSortBy] ?? 'createdAt';

    const captures = await this.captureModel
      .find(
        filter,
        {
          image_url: 1,
          createdAt: 1,
          captured_at: 1,
          species: 1,
          confidence: 1,
          ai_summary: 1,
          zone_id: 1,
          risk_score: 1,
          risk_reasons: 1,
          priority: 1,
          status: 1,
        },
      )
      .sort({ [sortField]: sortDirection })
      .limit(parsedLimit)
      .lean();

    return captures.map((capture) => ({
      id: String(capture._id),
      url: capture.image_url,
      createdAt: capture.createdAt,
      capturedAt: capture.captured_at ?? capture.createdAt,
      species: capture.species,
      confidence: capture.confidence,
      aiSummary: capture.ai_summary ?? null,
      zoneId: capture.zone_id ?? null,
      riskScore: capture.risk_score ?? 0,
      riskReasons: capture.risk_reasons ?? [],
      priority: capture.priority ?? 'low',
      status: capture.status,
    }));
  }

  @Patch('needs-review/:id/action')
  async reviewAction(
    @Param('id') id: string,
    @Body('action') action?: string,
  ) {
    const normalizedAction = (action ?? '').trim().toLowerCase();
    if (!['approve', 'discard', 'escalate'].includes(normalizedAction)) {
      throw new BadRequestException(
        'action must be one of: approve, discard, escalate',
      );
    }

    const capture = await this.captureModel.findById(id);
    if (!capture) {
      throw new NotFoundException('Capture not found');
    }

    if (normalizedAction === 'approve') {
      capture.status = 'approved';
      capture.should_alert = false;
    } else if (normalizedAction === 'discard') {
      capture.status = 'discard';
      capture.should_alert = false;
    } else {
      capture.status = 'needs_review';
      capture.should_alert = true;
      capture.priority = 'high';
      capture.risk_reasons = [
        ...(capture.risk_reasons ?? []),
        'manual_escalation',
      ];
    }

    await capture.save();

    const actionMessageMap: Record<string, string> = {
      approve: 'approved',
      discard: 'discarded',
      escalate: 'escalated',
    };

    return {
      id: String(capture._id),
      status: capture.status,
      shouldAlert: Boolean(capture.should_alert),
      priority: capture.priority ?? 'low',
      riskReasons: capture.risk_reasons ?? [],
      message: `Capture ${actionMessageMap[normalizedAction]}`,
    };
  }

  @Patch('needs-review/actions/bulk')
  async reviewBulkAction(
    @Body('ids') ids?: string[],
    @Body('action') action?: string,
  ) {
    const normalizedAction = (action ?? '').trim().toLowerCase();
    if (!['approve', 'discard', 'escalate'].includes(normalizedAction)) {
      throw new BadRequestException(
        'action must be one of: approve, discard, escalate',
      );
    }

    const normalizedIds = Array.isArray(ids)
      ? ids.map((id) => String(id).trim()).filter((id) => id.length > 0)
      : [];
    if (normalizedIds.length === 0) {
      throw new BadRequestException('ids must be a non-empty array');
    }

    let result: { matchedCount?: number; modifiedCount?: number } = {};

    if (normalizedAction === 'approve') {
      result = await this.captureModel.updateMany(
        { _id: { $in: normalizedIds } },
        {
          $set: {
            status: 'approved',
            should_alert: false,
          },
        },
      );
    } else if (normalizedAction === 'discard') {
      result = await this.captureModel.updateMany(
        { _id: { $in: normalizedIds } },
        {
          $set: {
            status: 'discard',
            should_alert: false,
          },
        },
      );
    } else {
      result = await this.captureModel.updateMany(
        { _id: { $in: normalizedIds } },
        {
          $set: {
            status: 'needs_review',
            should_alert: true,
            priority: 'high',
          },
          $addToSet: {
            risk_reasons: 'manual_escalation',
          },
        },
      );
    }

    return {
      action: normalizedAction,
      requested: normalizedIds.length,
      matched: Number(result.matchedCount ?? 0),
      modified: Number(result.modifiedCount ?? 0),
      message: `Bulk ${normalizedAction} completed`,
    };
  }

  @Get('conservation/list')
  conservationList(@Query('q') q?: string, @Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const query = (q ?? '').trim().toLowerCase();

    const filtered = this.conservationSpecies.filter((item) => {
      if (!query) return true;
      return (
        item.commonName.toLowerCase().includes(query) ||
        item.scientificName.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.conservationStatus.toLowerCase().includes(query)
      );
    });

    const results = filtered.slice(0, parsedLimit);

    return {
      query: q ?? '',
      limit: parsedLimit,
      count: filtered.length,
      results,
    };
  }

  @Get('dashboard/overview')
  async dashboardOverview(@Query('days') days?: string) {
    const parsedDays = Math.min(Math.max(Number(days) || 7, 1), 30);

    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (parsedDays - 1));

    const [dailyTrendRaw, statusRaw, topSpeciesRaw, hourlyRaw, alertCount] =
      await Promise.all([
        this.captureModel.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.captureModel.aggregate([
          { $match: { createdAt: { $gte: start } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.captureModel.aggregate([
          { $match: { createdAt: { $gte: start } } },
          { $group: { _id: '$species', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
        this.captureModel.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.captureModel.countDocuments({
          createdAt: { $gte: start },
          should_alert: true,
        }),
      ]);

    const dailyMap = new Map<string, number>(
      dailyTrendRaw.map((item: any) => [String(item._id), Number(item.count)]),
    );

    const dailyTrend = Array.from({ length: parsedDays }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      return {
        day: key,
        count: dailyMap.get(key) ?? 0,
      };
    });

    const statusMap = new Map<string, number>(
      statusRaw.map((item: any) => [String(item._id || 'unknown'), Number(item.count)]),
    );

    const hourlyMap = new Map<number, number>(
      hourlyRaw.map((item: any) => [Number(item._id), Number(item.count)]),
    );
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) ?? 0,
    }));

    return {
      days: parsedDays,
      range: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
      totals: {
        captures: dailyTrend.reduce((sum, d) => sum + d.count, 0),
        alerts: alertCount,
        approved: statusMap.get('approved') ?? 0,
        needs_review: statusMap.get('needs_review') ?? 0,
        discard: statusMap.get('discard') ?? 0,
      },
      statuses: Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      })),
      topSpecies: topSpeciesRaw.map((item: any) => ({
        species: item._id ?? 'unknown',
        count: Number(item.count),
      })),
      dailyTrend,
      hourlyActivity,
    };
  }
}
