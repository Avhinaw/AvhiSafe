import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { rateLimit } from "../middleware/security.js";
import type { AssetDocument, AssetPriceDocument, PortfolioSnapshotDocument, TokenBalanceDocument, TransactionDocument, WalletSyncDocument, TransactionSyncDocument } from "../models/index.js";
import { loadPortfolioAddress } from "../portfolioService.js";
import { normalizeWalletAddress } from "../walletValidation.js";

const portfolioAddress = z.object({
  id: z.string().min(1).max(120),
  label: z.string().max(160),
  address: z.string().min(20).max(128),
  chain: z.enum(["ethereum", "solana"]),
  source: z.enum(["wallet", "watch", "connected"]),
}).strict();

const portfolioInput = z.object({ addresses: z.array(portfolioAddress).min(1).max(50) }).strict();

export const portfolioRoutes = Router();
portfolioRoutes.use(rateLimit({ windowMs: 60_000, max: 30, message: "Too many portfolio refreshes. Please try again shortly." }));

portfolioRoutes.post("/", async (request, response) => {
  try {
    const input = portfolioInput.parse(request.body);
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const requested = input.addresses.map((address) => ({ ...address, normalizedAddress: normalizeWalletAddress(address.chain, address.address) }));
    const ownedWallets = await (await collections.wallets()).find({
      userId: request.auth.userId,
      status: "active",
      $or: requested.map((address) => ({ chainFamily: address.chain, normalizedAddress: address.normalizedAddress })),
    }).toArray();
    const ownedKeys = new Set(ownedWallets.map((wallet) => `${wallet.chainFamily}:${wallet.normalizedAddress}`));
    const unauthorized = requested.find((address) => !ownedKeys.has(`${address.chain}:${address.normalizedAddress}`));
    if (unauthorized) return response.status(403).json({ error: "Portfolio requests may only include active wallets owned by the signed-in account." });
    const snapshots = await Promise.all(requested.map(({ normalizedAddress: _normalizedAddress, ...address }) => loadPortfolioAddress(address)));
    const walletByKey = new Map(ownedWallets.map((wallet) => [`${wallet.chainFamily}:${wallet.normalizedAddress}`, wallet]));
    const userId = request.auth.userId;
    const now = new Date();
    const networksCollection = await collections.networks();
    const assetsCollection = await collections.assets();
    const pricesCollection = await collections.assetPrices();
    const balancesCollection = await collections.tokenBalances();
    const portfolioCollection = await collections.snapshots();
    const transactionsCollection = await collections.transactions();
    const walletSyncsCollection = await collections.walletSyncs();
    const transactionSyncsCollection = await collections.transactionSyncs();

    await Promise.all(snapshots.map(async (snapshot) => {
      const normalizedAddress = normalizeWalletAddress(snapshot.address.chain, snapshot.address.address);
      const wallet = walletByKey.get(`${snapshot.address.chain}:${normalizedAddress}`);
      if (!wallet) return;

      const networkKey = snapshot.address.chain === "ethereum" ? "ethereum-mainnet" : "solana-mainnet";
      const networkId = `network:${networkKey}`;
      const nativeAssetId = `asset:${networkKey}:native`;
      const hasUsableData = snapshot.dataQuality !== "error" && snapshot.dataQuality !== "unavailable";
      await networksCollection.updateOne(
        { key: networkKey },
        { $setOnInsert: {
          _id: networkId, key: networkKey, chainFamily: snapshot.address.chain,
          chainId: snapshot.address.chain === "ethereum" ? "1" : "mainnet-beta",
          name: snapshot.address.chain === "ethereum" ? "Ethereum" : "Solana",
          shortName: snapshot.nativeSymbol, environment: "mainnet", enabled: true,
          capabilities: ["balances", "tokens", "transactions"], createdAt: now, updatedAt: now,
        } },
        { upsert: true },
      );

      if (hasUsableData) {
      const assets: AssetDocument[] = [{
        _id: nativeAssetId, networkId, chainFamily: snapshot.address.chain, assetType: "native",
        symbol: snapshot.nativeSymbol, name: snapshot.address.chain === "ethereum" ? "Ether" : "Solana",
        decimals: snapshot.address.chain === "ethereum" ? 18 : 9, verified: true,
        metadataSource: snapshot.source, metadataUpdatedAt: now, createdAt: now, updatedAt: now,
      }, ...snapshot.tokens.map((token): AssetDocument => {
        const address = token.contract || token.id;
        const normalizedAssetAddress = address.toLowerCase();
        return {
          _id: `asset:${networkKey}:token:${normalizedAssetAddress}`,
          networkId, chainFamily: snapshot.address.chain, assetType: "token",
          contractAddress: snapshot.address.chain === "ethereum" ? normalizedAssetAddress : undefined,
          mintAddress: snapshot.address.chain === "solana" ? address : undefined,
          symbol: token.symbol, name: token.name, decimals: token.decimals,
          verified: false, metadataSource: snapshot.source, metadataUpdatedAt: now, createdAt: now, updatedAt: now,
        };
      })];

      const balanceRows = [{
        assetId: nativeAssetId, quantity: String(snapshot.nativeBalance),
        decimals: snapshot.address.chain === "ethereum" ? 18 : 9,
        price: snapshot.nativePriceUsd, value: snapshot.nativeValueUsd,
      }, ...snapshot.tokens.map((token) => ({
        assetId: `asset:${networkKey}:token:${(token.contract || token.id).toLowerCase()}`,
        quantity: String(token.amount), decimals: token.decimals,
        price: token.priceUsd, value: token.valueUsd,
      }))];

      await Promise.all(assets.map((asset) => {
        const { _id, createdAt, ...fields } = asset;
        return assetsCollection.updateOne(
          { _id },
          { $set: { ...fields, updatedAt: now }, $setOnInsert: { _id, createdAt } },
          { upsert: true },
        );
      }));

      await Promise.all(balanceRows.map(async (balance) => {
        const quality = snapshot.dataQuality === "unavailable" ? "unavailable" : snapshot.dataQuality;
        const balanceDocument: TokenBalanceDocument = {
          _id: `${userId}:${wallet._id}:${networkId}:${balance.assetId}`,
          userId, walletId: wallet._id, networkId, assetId: balance.assetId,
          quantity: balance.quantity, decimals: balance.decimals, formattedQuantity: balance.quantity,
          price: balance.price, value: balance.value, currency: "USD", source: snapshot.source,
          fetchedAt: new Date(snapshot.fetchedAt), dataQuality: quality,
        };
        await balancesCollection.replaceOne(
          { userId, walletId: wallet._id, networkId, assetId: balance.assetId },
          balanceDocument,
          { upsert: true },
        );
        const portfolioSnapshot: PortfolioSnapshotDocument = {
          _id: randomUUID(), userId, walletId: wallet._id, networkId, assetId: balance.assetId,
          quantity: balance.quantity, price: balance.price, value: balance.value,
          currency: "USD", source: snapshot.source, dataQuality: quality,
          observedAt: new Date(snapshot.updatedAt), fetchedAt: new Date(snapshot.fetchedAt),
        };
        await portfolioCollection.insertOne(portfolioSnapshot);
        if (typeof balance.price === "number" && Number.isFinite(balance.price)) {
          const priceDocument: AssetPriceDocument = {
            _id: randomUUID(), assetId: balance.assetId, currency: "USD", price: balance.price,
            source: snapshot.source, observedAt: new Date(snapshot.updatedAt), fetchedAt: new Date(snapshot.fetchedAt),
            confidence: snapshot.dataQuality === "complete" ? "medium" : "low", isEstimated: true,
          };
          await pricesCollection.insertOne(priceDocument);
        }
      }));

      await Promise.all(snapshot.transactions.map(async (transaction) => {
        const timestamp = transaction.timestamp ? new Date(transaction.timestamp * 1000) : new Date(snapshot.updatedAt);
        const txDocument: TransactionDocument = {
          _id: `${userId}:${wallet._id}:${networkId}:${transaction.hash}`,
          userId, walletId: wallet._id, networkId, txHash: transaction.hash,
          direction: transaction.from?.toLowerCase() === normalizedAddress ? "out" : transaction.to?.toLowerCase() === normalizedAddress ? "in" : "unknown",
          status: transaction.status?.toLowerCase() === "failed" ? "failed" : transaction.status?.toLowerCase() === "pending" ? "pending" : "confirmed",
          timestamp,
          assetTransfers: transaction.value ? [{ assetId: nativeAssetId, quantity: String(transaction.value), direction: transaction.from?.toLowerCase() === normalizedAddress ? "out" : "in", from: transaction.from, to: transaction.to }] : [],
          counterparty: transaction.from?.toLowerCase() === normalizedAddress ? transaction.to : transaction.from,
          source: snapshot.source, fetchedAt: new Date(snapshot.fetchedAt), dataQuality: snapshot.dataQuality === "unavailable" ? "partial" : snapshot.dataQuality,
          rawSourceId: transaction.hash,
        };
        const { _id, ...transactionFields } = txDocument;
        await transactionsCollection.updateOne(
          { userId, walletId: wallet._id, networkId, txHash: transaction.hash },
          { $set: transactionFields, $setOnInsert: { _id } },
          { upsert: true },
        );
      }));
      }

      const syncStatus = snapshot.dataQuality === "error" ? "failed" : snapshot.dataQuality === "complete" ? "success" : "partial";
      const syncBase = {
        userId, walletId: wallet._id, networkId, status: syncStatus,
        startedAt: new Date(snapshot.fetchedAt), completedAt: now, lastSuccessfulAt: syncStatus === "failed" ? undefined : now,
        recordsFetched: hasUsableData ? snapshot.tokens.length + 1 : 0, provider: snapshot.source, retryCount: 0, updatedAt: now,
      } as const;
      const syncId = randomUUID();
      const walletSync: WalletSyncDocument = { _id: syncId, ...syncBase, createdAt: now, ...(snapshot.error ? { errorCode: "provider_error", errorMessage: snapshot.error.slice(0, 300) } : {}) };
      const transactionSync: TransactionSyncDocument = { _id: randomUUID(), ...syncBase, recordsFetched: snapshot.transactions.length, createdAt: now, ...(snapshot.error ? { errorCode: "provider_error", errorMessage: snapshot.error.slice(0, 300) } : {}) };
      await Promise.all([
        walletSyncsCollection.insertOne(walletSync),
        transactionSyncsCollection.insertOne(transactionSync),
        ...(syncStatus === "failed" ? [] : [(await collections.wallets()).updateOne({ _id: wallet._id, userId }, { $set: { lastSyncedAt: now, updatedAt: now } })]),
      ]);
    }));
    const usableSnapshots = snapshots.filter((snapshot) => snapshot.dataQuality !== "error" && snapshot.dataQuality !== "unavailable");
    const totalValue = usableSnapshots.reduce((total, snapshot) =>
      total + (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((sum, token) => sum + (token.valueUsd || 0), 0), 0);
    const aggregateQuality = usableSnapshots.length === 0
      ? "unavailable"
      : usableSnapshots.length !== snapshots.length || usableSnapshots.some((snapshot) => snapshot.dataQuality !== "complete")
        ? "partial"
        : "complete";
    const historySnapshot: PortfolioSnapshotDocument = {
      _id: randomUUID(),
      userId,
      walletId: "portfolio",
      networkId: "portfolio:aggregate",
      assetId: "portfolio:total",
      quantity: String(totalValue),
      price: totalValue,
      value: totalValue,
      currency: "USD",
      source: "portfolio-aggregate",
      dataQuality: aggregateQuality,
      observedAt: now,
      fetchedAt: now,
    };
    if (usableSnapshots.length) await (await collections.snapshots()).insertOne(historySnapshot);
    return response.json({ snapshots, fetchedAt: new Date().toISOString(), providerMode: "backend-adapters" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio request." });
  }
});

portfolioRoutes.get("/history", async (request, response) => {
  try {
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
    const snapshots = await (await collections.snapshots()).find({ userId: request.auth.userId, assetId: "portfolio:total" }).sort({ fetchedAt: -1 }).limit(limit * 50).toArray();
    const grouped = new Map<number, { value: number; source: string; dataQuality: string; walletId?: string }>();
    for (const snapshot of snapshots) {
      const timestamp = snapshot.fetchedAt.getTime();
      const value = snapshot.value ?? Number(snapshot.quantity) ?? 0;
      const existing = grouped.get(timestamp);
      if (snapshot.source === "portfolio-aggregate" || !existing) {
        grouped.set(timestamp, { value, source: snapshot.source, dataQuality: snapshot.dataQuality, walletId: snapshot.walletId === "portfolio" ? undefined : snapshot.walletId });
      } else if (existing.source !== "portfolio-aggregate") {
        grouped.set(timestamp, {
          value: existing.value + value,
          source: "portfolio-history",
          dataQuality: existing.dataQuality === "complete" && snapshot.dataQuality === "complete" ? "complete" : "partial",
        });
      }
    }
    const history = [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .slice(-limit)
      .map(([timestamp, point]) => ({ timestamp, ...point }));
    return response.json({ history });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : "Unable to load portfolio history." });
  }
});
