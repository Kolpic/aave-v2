import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

function isLocalNetwork(): boolean {
  const network = process.env.NETWORK || 'hardhat';
  return network === 'hardhat' || network === 'localhost';
}

async function main() {
  const network = process.env.NETWORK || 'localhost';
  const isLocal = isLocalNetwork();
  
  // Auto-select addresses based on network
  const lendingPoolAddress = isLocal
    ? (process.env.LOCAL_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS)
    : (process.env.SEPOLIA_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS);
    
  const tokenAddress = isLocal
    ? (process.env.LOCAL_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS)
    : (process.env.SEPOLIA_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS);

  if (!lendingPoolAddress || !tokenAddress) {
    console.log('❌ Missing required environment variables!');
    console.log('Need: LENDING_POOL_ADDRESS and TOKEN_ADDRESS');
    console.log('Or: LOCAL_*/SEPOLIA_* prefixed versions based on NETWORK setting');
    return;
  }

  const tokenName = process.env.TOKEN_NAME || 'TOKEN';
  
  console.log('=== Checking Pool Configuration ===\n');
  console.log('Network:', network);
  console.log('Pool:', lendingPoolAddress);
  console.log('Token:', tokenName);
  console.log('Token Address:', tokenAddress);
  console.log('');
  
  const pool = await ethers.getContractAt('ILendingPool', lendingPoolAddress);
  
  // Check if entire pool is paused
  let isPoolPaused = false;
  try {
    isPoolPaused = await pool.paused();
    console.log('=== Pool Status ===');
    console.log('Pool Paused:', isPoolPaused);
    console.log('');
    
    if (isPoolPaused) {
      console.log('⚠️  WARNING: The entire pool is PAUSED!');
      console.log('This blocks ALL deposits, withdrawals, and borrows.');
      console.log('Even if the reserve is active, you cannot interact with it.\n');
    }
  } catch (e) {
    console.log('⚠️  Could not check pool pause status\n');
  }
  
  try {
    const reserveData = await pool.getReserveData(tokenAddress);
    
    console.log('=== Reserve Configuration ===');
    console.log('aToken:', reserveData.aTokenAddress);
    console.log('Stable Debt Token:', reserveData.stableDebtTokenAddress);
    console.log('Variable Debt Token:', reserveData.variableDebtTokenAddress);
    console.log('Interest Rate Strategy:', reserveData.interestRateStrategyAddress);
    console.log('Configuration Data:', reserveData.configuration.data.toString());
    
    // Decode configuration - Use correct bit positions
    const configData = reserveData.configuration.data;
    const isActive = configData.shr(56).and(1).eq(1);   // Bit 56
    const isFrozen = configData.shr(57).and(1).eq(1);   // Bit 57
    
    console.log('\n=== Reserve Status ===');
    console.log('Is Active:', isActive);
    console.log('Is Frozen:', isFrozen);
    
    if (reserveData.aTokenAddress === ethers.constants.AddressZero) {
      console.log(`\n❌ ERROR: ${tokenName} is NOT initialized in this pool!`);
      console.log('\nYou need to either:');
      console.log(`1. Use a different pool that supports ${tokenName}`);
      console.log(`2. Use the correct ${tokenName} token address for this pool`);
      console.log('3. Deploy your own pool with this token initialized');
      console.log('\n💡 Run list-pool-reserves.ts to see what tokens ARE supported');
    } else if (!isActive) {
      console.log('\n❌ ERROR: Reserve is not active!');
    } else if (isFrozen) {
      console.log('\n❌ ERROR: Reserve is frozen!');
    } else {
      console.log('\n=== Final Verdict ===');
      console.log('✅ Reserve is configured correctly');
      
      if (isPoolPaused) {
        console.log('❌ BUT the pool is PAUSED - all deposits will fail with error 64!');
        console.log('\n💡 Solutions:');
        console.log('   1. Wait for the pool to be unpaused (if temporary)');
        console.log('   2. Use a different pool that is not paused');
      } else {
        console.log(`✅ Pool is active - you should be able to deposit ${tokenName}!`);
      }
    }
  } catch (error: any) {
    console.log('\n❌ ERROR reading reserve data:', error.message);
    console.log(`\nThis usually means the ${tokenName} token is not supported by this pool.`);
    console.log('\n💡 Run list-pool-reserves.ts to see what tokens ARE supported');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });