import { Router } from "express";
import { addWatchOnlyWallet, connectWallet, listWallets, removeWallet, updateWallet } from "../controllers/walletController.js";
import { authenticate } from "../middleware/authenticate.js";

export const walletRoutes = Router();
walletRoutes.use(authenticate);
walletRoutes.get("/", listWallets);
walletRoutes.post("/watch-only", addWatchOnlyWallet);
walletRoutes.post("/connected", connectWallet);
walletRoutes.patch("/:walletId", updateWallet);
walletRoutes.delete("/:walletId", removeWallet);
