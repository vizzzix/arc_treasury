# 🔄 Redeploy Guide - Updated Contracts

## What Changed

### Smart Contract Updates (AITreasury.sol)

✅ **New Features:**
1. `getUserTreasuries(address user)` - Get all treasuries owned by a user
2. `deleteTreasury(address treasury)` - Delete treasury (only if balance = 0)
3. `userTreasuries` mapping - Track treasuries per user
4. `treasuryExists` mapping - Check if treasury is valid

✅ **Benefits:**
- Auto-load treasuries from blockchain (no more localStorage only)
- Safe deletion with balance check
- Better treasury management

---

## 🚀 How to Redeploy

### Option 1: Redeploy All Contracts (Recommended)

```bash
# 1. Compile contracts
npm run compile

# 2. Deploy to Arc Testnet
npm run deploy:testnet

# 3. Update contract addresses in frontend
# The deploy script auto-updates src/contracts/contractAddresses.ts

# 4. Build frontend
npm run build

# 5. Deploy to Vercel
vercel --prod --token YOUR_VERCEL_TOKEN --yes
```

### Option 2: Test Locally First

```bash
# 1. Start local Hardhat node
npm run node

# 2. In new terminal, deploy locally
npm run deploy

# 3. Test frontend
npm run dev

# 4. Once tested, deploy to testnet (see Option 1)
```

---

## ⚠️ Important Notes

### Data Migration

**Old treasuries (created with previous contract) will NOT work with new contract.**

Users will need to:
1. Withdraw all funds from old treasury
2. Create new treasury with updated contract
3. Deposit funds into new treasury

### Backward Compatibility

❌ Old contract treasuries won't appear in `getUserTreasuries()`  
❌ Delete function only works on new treasuries  
✅ Token contracts (USDC/EURC/XSGD) remain the same

---

## 📝 Deployment Checklist

- [ ] Backup current contract addresses
- [ ] Compile contracts (`npm run compile`)
- [ ] Deploy to Arc Testnet (`npm run deploy:testnet`)
- [ ] Verify contracts on ArcScan
- [ ] Update frontend contract addresses
- [ ] Test create/delete treasury
- [ ] Deploy frontend to Vercel
- [ ] Announce to users about contract upgrade

---

## 🧪 Testing Delete Functionality

### Test Case 1: Delete Empty Treasury
```
1. Create new treasury
2. Don't deposit any funds
3. Click "Delete" button
4. Confirm transaction
5. ✅ Should delete successfully
```

### Test Case 2: Delete Treasury with Funds (Should Fail)
```
1. Create treasury
2. Deposit 100 USDC
3. Click "Delete" button
4. ❌ Should show error: "Cannot delete treasury with funds"
5. Withdraw all funds
6. Try delete again
7. ✅ Should succeed
```

### Test Case 3: Auto-Load Treasuries
```
1. Create 2 treasuries
2. Refresh page
3. ✅ Both should appear in dropdown/list
4. ✅ No need for localStorage
```

---

## 🔐 Security Considerations

✅ `onlyTreasuryOwner` modifier - Only owner can delete  
✅ Balance check - Must be zero before deletion  
✅ Event emitted - `TreasuryDeleted` for transparency  
✅ Mapping cleanup - Removed from `userTreasuries` array

---

## 📊 New Contract Functions

```solidity
// Get user's treasuries
function getUserTreasuries(address user) 
  external view 
  returns (address[] memory)

// Delete treasury (balance must be 0)
function deleteTreasury(address treasuryAddr) 
  external 
  onlyTreasuryOwner(treasuryAddr)

// Event
event TreasuryDeleted(address indexed owner, address indexed treasury)
```

---

## 🎯 User Benefits

1. **Multi-Treasury Support** - Users can have multiple treasuries
2. **Persistent Storage** - Treasuries stored on-chain, not localStorage
3. **Safe Deletion** - Can only delete empty treasuries
4. **Auto-Sync** - Treasuries auto-load on wallet connection

---

Built for Arc Treasury 🏦

