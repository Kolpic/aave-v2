import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const [user] = await ethers.getSigners();
  
  // Sepolia faucet addresses (if they exist) or mint if you control them
  const dai = await ethers.getContractAt('IERC20', process.env.DAI_ADDRESS!);
  const usdc = await ethers.getContractAt('IERC20', process.env.USDC_ADDRESS!);
  
  console.log('Getting test tokens for:', user.address);
  console.log('Visit Aave faucet: https://app.aave.com/faucet/');
}

main();