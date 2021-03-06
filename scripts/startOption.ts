// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import * as time from "../test/helpers/time";
import { Wallet, BigNumber, Contract, utils } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  const ONE = ethers.utils.parseUnits("1", 18);
  const TWO = ethers.utils.parseUnits("2", 18);
  const ERC20Option = await ethers.getContractAt("ERC20Option", "0x164ce3A917BE4F954b2155057635A5Cd1e1A3f70");
  const token = await ethers.getContractAt("ERC20Mock", "0x12AD50Fb037715DBb61D4336D85fd18d97f40fB2");
  const tokenB = await token.balanceOf(deployer.address);
  await ERC20Option.setStrikes([12, 22, 33]);
  await ERC20Option.startNextEpoch();
  console.log("Token balance:", tokenB);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
