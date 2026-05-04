import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["viewer", "seller", "admin"]);
export const showStatus = pgEnum("show_status", [
  "scheduled",
  "live",
  "ended",
  "cancelled",
]);
export const lotStatus = pgEnum("lot_status", [
  "queued",
  "live",
  "sold",
  "unsold",
]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "refunded",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    role: userRole("role").notNull().default("viewer"),
    ageVerifiedAt: timestamp("age_verified_at", { withTimezone: true }),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    handleIdx: uniqueIndex("users_handle_idx").on(t.handle),
  }),
);

export const sellers = pgTable("sellers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  storeName: text("store_name").notNull(),
  bio: text("bio"),
  payoutProvider: text("payout_provider"),
  payoutAccountRef: text("payout_account_ref"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const shows = pgTable(
  "shows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    status: showStatus("status").notNull().default("scheduled"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    muxLiveStreamId: text("mux_live_stream_id"),
    muxStreamKey: text("mux_stream_key"),
    muxPlaybackId: text("mux_playback_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sellerIdx: index("shows_seller_idx").on(t.sellerId),
    statusIdx: index("shows_status_idx").on(t.status),
  }),
);

export const lots = pgTable(
  "lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    startingBidCents: integer("starting_bid_cents").notNull(),
    minIncrementCents: integer("min_increment_cents").notNull().default(100),
    softCloseSeconds: integer("soft_close_seconds").notNull().default(10),
    status: lotStatus("status").notNull().default("queued"),
    currentBidCents: integer("current_bid_cents"),
    currentBidUserId: uuid("current_bid_user_id").references(() => users.id),
    bidCount: integer("bid_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    showIdx: index("lots_show_idx").on(t.showId),
    statusIdx: index("lots_status_idx").on(t.status),
  }),
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    accepted: boolean("accepted").notNull(),
    rejectReason: text("reject_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    lotIdx: index("bids_lot_idx").on(t.lotId),
    userIdx: index("bids_user_idx").on(t.userId),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    status: orderStatus("status").notNull().default("pending_payment"),
    paymentProvider: text("payment_provider"),
    paymentRef: text("payment_ref"),
    shippingAddress: text("shipping_address"),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    buyerIdx: index("orders_buyer_idx").on(t.buyerId),
    sellerIdx: index("orders_seller_idx").on(t.sellerId),
  }),
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    showIdx: index("chat_show_idx").on(t.showId, t.createdAt),
  }),
);

export const ageVerifications = pgTable("age_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  status: text("status").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.sellerId] }),
  }),
);

export const showsRelations = relations(shows, ({ one, many }) => ({
  seller: one(users, { fields: [shows.sellerId], references: [users.id] }),
  lots: many(lots),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  show: one(shows, { fields: [lots.showId], references: [shows.id] }),
  bids: many(bids),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  lot: one(lots, { fields: [bids.lotId], references: [lots.id] }),
  user: one(users, { fields: [bids.userId], references: [users.id] }),
}));
