import { expect } from "chai";
import { ethers } from "hardhat";
import { Wallet, BigNumber, Contract, utils } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import tokenInterface from "../artifacts/contracts/VaultToken.sol/VaultToken.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as time from "./helpers/time";
import { Provider } from "@ethersproject/providers";

describe("unit:ERC20Option", function () {
  let ERC20Collateral: Contract;
  let ERC20Option: Contract;
  let provider: Provider;
  let Signers: SignerWithAddress[];
  const ONE = ethers.utils.parseUnits("1", 18);
  const TWO = ethers.utils.parseUnits("2", 18);
  const timeInterval = BigNumber.from("100");
  describe("#mintOption", function () {
    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      provider = await ethers.getDefaultProvider();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, ONE);
      await ERC20Collateral.mint(Signers[1].address, ONE);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();

      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, ONE);
    });

    it("should recieve tokens", async function () {
      const depositor = Signers[1];
      await ERC20Option.connect(depositor).mintOption(1, ONE, depositor.address);
      const contractTokenBalance = await ERC20Collateral.balanceOf(ERC20Option.address);
      expect(contractTokenBalance).to.equal(ONE);
    });
    it("should emit when tokens recieved", async function () {
      const depositor = Signers[1];
      await expect(ERC20Option.connect(depositor).mintOption(1, ONE, depositor.address)).to.emit(
        ERC20Option,
        "NewDeposit",
      );
    });
    it("should mint tokens and send to user", async function () {
      const depositor = Signers[1];
      await expect(ERC20Option.connect(depositor).mintOption(1, ONE, depositor.address)).to.emit(
        ERC20Option,
        "NewDeposit",
      );
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      const optionBalance = await optionTokenContract.balanceOf(depositor.address);
      expect(optionBalance).to.equal(ONE);
    });
    it("should revert if strike index is invalid", async function () {
      const depositor = Signers[1];
      await expect(ERC20Option.connect(depositor).mintOption(10, ONE, depositor.address)).to.revertedWith("E");
    });
  });

  describe("#settle", function () {
    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      provider = await ethers.getDefaultProvider();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, ONE);
      await ERC20Collateral.mint(Signers[1].address, ONE);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();
      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, ONE);
      // mint options
      await ERC20Option.connect(Signers[1]).mintOption(1, ONE, Signers[1].address);
    });
    it("should allow users to exercise options in the exercise window", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(21);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await ERC20Option.connect(Signers[1]).settle(1, ONE, 1);
      const optionBalance = await optionTokenContract.balanceOf(Signers[1].address);
      expect(optionBalance).to.equal(0);
    });
    it("should not allow users to exercise options after the exercise window", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(21);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(1, ONE, 1)).to.revertedWith("E");
    });
    it("should not allow users to exercise options before the exercise window", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(10000));
      await expect(ERC20Option.openSettlement(21)).to.revertedWith("E");
      await expect(ERC20Option.connect(Signers[1]).settle(1, ONE, 1)).to.revertedWith("E");
    });
    it("should send the profit to the user", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(1, ONE, 1)).to.emit(ERC20Option, "SettleOption");
      const profit = await ERC20Collateral.balanceOf(Signers[1].address);
      expect(profit).to.equal(ethers.utils.parseUnits("0.5", await ERC20Collateral.decimals()));
    });
    it("should not send any tokens when the user has a negative PnL", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(1, ONE, 1)).to.emit(ERC20Option, "SettleOption");
      const profit = await ERC20Collateral.balanceOf(Signers[1].address);
      expect(profit).to.equal(ethers.utils.parseUnits("0.5", await ERC20Collateral.decimals()));
    });
    it("should trigger and event when a valid claim is made", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(21);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(1, ONE, 1)).to.emit(ERC20Option, "SettleOption");
    });
    it("should revert if strike index is invalid", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(21);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(10, ONE, 1)).to.revertedWith("E");
    });
    it("should revert if amount greater than balance", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(21);
      const tokenAddress = await ERC20Option.epochStrikeTokens(1, 20);
      const optionTokenContract = await ethers.getContractAt("VaultToken", tokenAddress);
      await optionTokenContract.connect(Signers[1]).approve(ERC20Option.address, ONE);
      await expect(ERC20Option.connect(Signers[1]).settle(10, TWO, 1)).to.revertedWith("E");
    });
  });

  describe("#withdrawCollateral", function () {
    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      provider = await ethers.getDefaultProvider();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, ONE);
      await ERC20Collateral.mint(Signers[1].address, ONE);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();
      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, ONE);
      // mint options
      await ERC20Option.connect(Signers[1]).mintOption(1, ONE, Signers[1].address);
    });
    it("should not allow depositors to claim before the epoch has ended", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await expect(ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1)).to.revertedWith("E");
      await ERC20Option.openSettlement(40);
      await expect(ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1)).to.revertedWith("E");
    });
    it("should return an accurate amount given the options expired in the money", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      await ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1);
      const userBalance = await ERC20Collateral.balanceOf(Signers[1].address);
      expect(userBalance).to.equal(ethers.utils.parseUnits("0.5", await ERC20Collateral.decimals()));
    });
    it("should return the full amount given the options expire worthless", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(10);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      await ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1);
      const userBalance = await ERC20Collateral.balanceOf(Signers[1].address);
      expect(userBalance).to.equal(ethers.utils.parseUnits("1", await ERC20Collateral.decimals()));
    });
    it("should trigger an event when the collateral is claimed", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      await expect(ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1)).to.emit(ERC20Option, "NewWithdraw");
    });

    it("should revert if epoch not expired", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await expect(ERC20Option.connect(Signers[1]).withdrawCollateral(1, 1)).to.be.revertedWith("E");
    });

    it("should revert if stroke index invalid", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await expect(ERC20Option.connect(Signers[1]).withdrawCollateral(1, 5)).to.be.revertedWith("E");
    });
    it("should revert if user deposit 0", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await expect(ERC20Option.connect(Signers[0]).withdrawCollateral(1, 1)).to.be.revertedWith("E");
    });
  });

  describe("#openSettlement", function () {
    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      provider = await ethers.getDefaultProvider();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, ONE);
      await ERC20Collateral.mint(Signers[1].address, ONE);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();
      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, ONE);
      // mint options
      await ERC20Option.connect(Signers[1]).mintOption(1, ONE, Signers[1].address);
    });
    it("should revert if settlement already open", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await expect(ERC20Option.openSettlement(40)).to.be.revertedWith("E");
    });
    it("should revert if settlement window has not been reached", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(100000));
      await expect(ERC20Option.openSettlement(40)).to.be.revertedWith("E");
    });
    it("should set settlement price and mark epoch as settlemnt open", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      const settlementPrice = await ERC20Option.settlementPrices(1);
      const settlementOpen = await ERC20Option.isSettlementOpen(1);
      expect(settlementPrice).to.equal(40);
      expect(settlementOpen).to.equal(true);
    });
  });
  describe("#expireEpoch", function () {
    this.beforeEach("deploy", async () => {
      Signers = await ethers.getSigners();
      provider = await ethers.getDefaultProvider();
      const ERC20CollateralFactory = await ethers.getContractFactory("ERC20Mock");
      ERC20Collateral = await ERC20CollateralFactory.deploy("test", "TST");
      await ERC20Collateral.deployed();
      await ERC20Collateral.mint(Signers[0].address, ONE);
      await ERC20Collateral.mint(Signers[1].address, ONE);

      const ERC20OptionFactory = await ethers.getContractFactory("ERC20Option");
      ERC20Option = await ERC20OptionFactory.deploy(ERC20Collateral.address);
      await ERC20Option.deployed();
      // set the strikes
      await ERC20Option.setStrikes([10, 20, 30]);
      // start the epoch
      await ERC20Option.startNextEpoch();
      // approve sening collateral
      await ERC20Collateral.connect(Signers[1]).approve(ERC20Option.address, ONE);
      // mint options
      await ERC20Option.connect(Signers[1]).mintOption(1, ONE, Signers[1].address);
    });
    it("should revert if epoch is expired", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      await expect(ERC20Option.expireEpoch()).to.be.revertedWith("E");
    });
    it("should revert if not past expiry", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(100000));
      await expect(ERC20Option.expireEpoch()).to.be.revertedWith("E");
    });
    it("should set epoch expired and mark epoch as settlemnt closed", async function () {
      await time.increaseTo((await ERC20Option.epochExpiry()).sub(timeInterval));
      await ERC20Option.openSettlement(40);
      await time.increaseTo((await ERC20Option.epochExpiry()).add(timeInterval));
      await ERC20Option.expireEpoch();
      const epochExpired = await ERC20Option.isEpochExpired(1);
      const settlementOpen = await ERC20Option.isSettlementOpen(1);
      expect(epochExpired).to.equal(true);
      expect(settlementOpen).to.equal(false);
    });
  });
});
