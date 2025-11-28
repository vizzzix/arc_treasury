import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt('TreasuryVaultV8', '0x17ca5232415430bc57f646a72fd15634807bf729');
  
  const totalUSDC = await vault.totalUSDC();
  const totalShares = await vault.totalShares();
  
  console.log('=== Vault State ===');
  console.log('totalUSDC (raw):', totalUSDC.toString());
  console.log('totalUSDC ($):', Number(totalUSDC) / 1e18);
  console.log('totalShares (raw):', totalShares.toString());
  
  if (totalShares > 0n) {
    const pps = await vault.getPricePerShare();
    console.log('pricePerShare (raw):', pps.toString());
    console.log('pricePerShare ($):', Number(pps) / 1e18);
    
    console.log('\n=== If you deposit 10 USDC ===');
    const deposit = 10n * BigInt(1e18);
    const shares = (deposit * BigInt(1e18)) / pps;
    console.log('You will get:', shares.toString(), 'raw shares');
    console.log('Value check: shares * pps / 1e18 =', Number(shares * pps / BigInt(1e18)) / 1e18, 'USDC');
  }
}

main().catch(console.error);
