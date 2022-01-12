import { expect } from "chai";
import { ethers } from "hardhat";
import { Wallet, BigNumber, Contract, utils } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import tokenInterface from "../artifacts/contracts/VaultToken.sol/VaultToken.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("unit:ERC20Option", function () {
  describe("deopsits and minting", function () {
    let ERC20Collateral: Contract;
    let ERC20Option: Contract;
    let Signers: SignerWithAddress[];

    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, 10000);
      await ERC20Collateral.mint(Signers[1].address, 10000);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();

      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, 100);
    });

    it("should handle collateral deposits", async function () {
      const depositor = Signers[1];
      await expect(ERC20Option.connect(depositor).mintOption(1, 100, depositor.address)).to.emit(
        ERC20Option,
        "NewDeposit",
      );
    });
    it("should mint tokens and sent to user", async function () {
      const depositor = Signers[1];
      await ERC20Option.connect(depositor).mintOption(1, 100, depositor.address);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      const optionBalance = await optionTokenContract.balanceOf(depositor.address);
      expect(optionBalance).to.equal(100);
    });
  });

  describe("Exercise options", function () {
    it("should allow users to exercise options only in the exercise window", async function () {});
    it("should send the profit to the user", async function () {});
    it("should not send any tokens when the user has a negative PnL", async function () {});
    it("should trigger and event when a valid claim is made", async function () {});
  });

  describe("Claiming collateral", function () {
    it("should allow depositors to claim remaining collateral after the epoch", async function () {});
    it("should not allow depositors to claim before the epoch has ended", async function () {});
    it("should return an accurate amount given the options expired in the money", async function () {});
    it("should return the full amount given the options expire worthless", async function () {});
    it("should trigger an event when the collateral is claimed", async function () {});
  });
});
