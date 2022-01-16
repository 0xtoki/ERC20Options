// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const ONE = ethers.utils.parseUnits("1", 18);
  const TWO = ethers.utils.parseUnits("2", 18);

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ERC20Option = await ethers.getContractAt("ERC20Option", "0xEcea0Efd3BB2665fb5bCce0D464423b35823f5dF");
  const token = await ethers.getContractAt("ERC20Mock", "0x8D06615cd97fD96AE5C3294a55930CB58D8d86C3");

  await token.mint(deployer.address, TWO);

  const tokenB = await token.balanceOf(deployer.address);

  await ERC20Option.setStrikes([10, 20, 30]);
  await ERC20Option.startNextEpoch();
  //const tokenAddressFirst = await ERC20Option.epochStrikeTokens(1, 10);
  //const optionTokenContractFirst = await ethers.getContractAt("VaultToken", tokenAddressFirst);
  //const firstTokenName = await optionTokenContractFirst.name();

  console.log("Token balance:", tokenB);
  //console.log("Token balance:", tokenBalance);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
