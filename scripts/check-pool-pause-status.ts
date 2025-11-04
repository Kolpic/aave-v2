// scripts/check-pool-pause-status.ts
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const poolAddress = process.env.SEPOLIA_LENDING_POOL_ADDRESS;
  const lendingPool = await ethers.getContractAt('ILendingPool', poolAddress!);
  
  try {
    const isPaused = await lendingPool.paused();
    console.log('Pool Paused Status:', isPaused);
    
    if (isPaused) {
      console.log('❌ The pool is PAUSED. You cannot deposit/withdraw/borrow.');
      console.log('💡 You need to find a different pool or deploy your own.');
    } else {
      console.log('✅ Pool is NOT paused');
    }
  } catch (e: any) {
    console.log('⚠️  Could not read pause status:', e.message);
  }
}

main().catch(console.error);