//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "hardhat/console.sol";

// libraries
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

// interfaces VaultToken
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { VaultToken } from "./VaultToken.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ERC20Option is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    address public immutable collateralAsset;

    /// @dev Current epoch for ssov
    uint256 public currentEpoch;

    uint256 public epochExpiry;

    /// @dev Expire delay tolerance
    uint256 public expireDelayTolerance = 5 minutes;

    /// @dev ERC20PresetMinterPauserUpgradeable implementation address
    address public immutable erc20Implementation;

    /// @notice Is vault ready for next epoch
    /// @dev epoch => whether the vault is ready (boostrapped)
    mapping(uint256 => bool) public isVaultReady;

    /// @notice Is the epoch ready
    /// @dev epoch => whether the epoch is active
    mapping(uint256 => bool) public isEpochActive;

    /// @dev Mapping of strikes for each epoch
    mapping(uint256 => uint256[]) public epochStrikes;

    /// @notice Is epoch expired
    /// @dev epoch => whether the epoch is expired
    mapping(uint256 => bool) public isEpochExpired;

    /// @dev Mapping of (epoch => (strike => tokens))
    mapping(uint256 => mapping(uint256 => address)) public epochStrikeTokens;

    /// @dev epoch => the epoch start time
    mapping(uint256 => uint256) public epochStartTimes;

    /// @notice Epoch deposits by user for each strike
    /// @dev mapping (epoch => (abi.encodePacked(user, strike) => user deposits))
    mapping(uint256 => mapping(bytes32 => uint256)) public userEpochDeposits;

    /// @notice Total epoch deposits for specific strikes
    /// @dev mapping (epoch => (strike => deposits))
    mapping(uint256 => mapping(uint256 => uint256)) public totalEpochStrikeDeposits;

    /// @notice Total epoch deposits across all strikes
    /// @dev mapping (epoch => deposits)
    mapping(uint256 => uint256) public totalEpochDeposits;

    /// @notice Total epoch deposits for specific strikes including premiums and rewards
    /// @dev mapping (epoch => (strike => deposits))
    mapping(uint256 => mapping(uint256 => uint256)) public totalEpochStrikeBalance;

    /// @notice Total epoch deposits across all strikes including premiums and rewards
    /// @dev mapping (epoch => deposits)
    mapping(uint256 => uint256) public totalEpochBalance;

    /// @dev epoch => settlement price
    mapping(uint256 => uint256) public settlementPrices;

    /// @notice Epoch asset balance per strike after accounting for rewards
    /// @dev mapping (epoch => (strike => balance))
    mapping(uint256 => mapping(uint256 => uint256)) public totalEpochStrikeAssetBalance;

    uint256 public WEEK = 7 days;

    /*==== EVENTS ====*/

    event NewDeposit(uint256 epoch, uint256 strike, uint256 amount, address user, address sender);

    event NewStrike(uint256 epoch, uint256 strike);

    event epochStarted(uint256 epoch);

    event SettleOption(uint256 epoch, uint256 strike, address user, uint256 amount, uint256 pnl);

    event NewWithdraw(uint256 epoch, uint256 strike, address user, uint256 amount);

    /*==== CONSTRUCTOR ====*/

    constructor(address _collateralAsset) {
        require(_collateralAsset != address(0), "E1");

        collateralAsset = _collateralAsset;

        currentEpoch = 0;
        erc20Implementation = address(new VaultToken());
    }

    /**
     * @notice initiates the next epoch
     * @return Whether it was successful
     */
    function startNextEpoch() external onlyOwner whenNotPaused returns (bool) {
        uint256 nextEpoch = currentEpoch + 1;
        require(!isVaultReady[nextEpoch], "E");
        require(epochStrikes[nextEpoch].length > 0, "E");

        if (currentEpoch > 0) {
            // Previous epoch must be expired
            require(isEpochExpired[currentEpoch], "E");
        }
        epochExpiry = block.timestamp + WEEK;

        for (uint256 i = 0; i < epochStrikes[nextEpoch].length; i++) {
            uint256 strike = epochStrikes[nextEpoch][i];
            string memory name = concatenate("ERC20-CALL", strike.toString());
            name = concatenate(name, "-EPOCH-");
            name = concatenate(name, (nextEpoch).toString());
            // Create doTokens representing calls for selected strike in epoch
            VaultToken _erc20 = VaultToken(Clones.clone(erc20Implementation));
            _erc20.initialize(name, name, strike, epochExpiry);
            epochStrikeTokens[nextEpoch][strike] = address(_erc20);
        }

        // Mark vault as ready for epoch
        isVaultReady[nextEpoch] = true;
        // Increase the current epoch
        currentEpoch = nextEpoch;
        isEpochActive[currentEpoch] = true;

        emit epochStarted(nextEpoch);

        return true;
    }

    /**
     * @notice Sets strikes for next epoch
     * @param strikes Strikes to set for next epoch
     * @return Whether strikes were set
     */
    function setStrikes(uint256[] memory strikes) external onlyOwner whenNotPaused returns (bool) {
        uint256 nextEpoch = currentEpoch + 1;

        if (currentEpoch > 0) {
            //(, uint256 epochExpiry) = getEpochTimes(currentEpoch);
            // epochExpiry is a month out from previous epoch
            require((block.timestamp > epochExpiry), "E");
        }

        // Set the next epoch strikes
        epochStrikes[nextEpoch] = strikes;
        // Set the next epoch start time
        epochStartTimes[nextEpoch] = block.timestamp;

        for (uint256 i = 0; i < strikes.length; i++) emit NewStrike(nextEpoch, strikes[i]);
        return true;
    }

    /**
     * @notice Deposits to mint options in the current epoch for selected strikes
     * @param strikeIndex Index of strike
     * @param amount Amout of collateral to deposit
     * @param user Address of the user to deposit for
     * @return Whether deposit was successful
     */
    function mintOption(
        uint256 strikeIndex,
        uint256 amount,
        address user
    ) public whenNotPaused returns (bool) {
        if (currentEpoch > 0) {
            require(isEpochActive[currentEpoch], "E");
        }

        // Must be a valid strikeIndex
        require(strikeIndex < epochStrikes[currentEpoch].length, "E1");

        // Must +ve amount
        require(amount > 0, "E2");

        // Must be a valid strike
        uint256 strike = epochStrikes[currentEpoch][strikeIndex];
        require(strike != 0, "E3");

        bytes32 userStrike = keccak256(abi.encodePacked(user, strike));

        // Transfer asset from msg.sender (maybe different from user param) to ssov
        IERC20(collateralAsset).safeTransferFrom(msg.sender, address(this), amount);

        // Mint user option tokens
        VaultToken(epochStrikeTokens[currentEpoch][strike]).mint(msg.sender, amount);

        // Add to user epoch deposits
        userEpochDeposits[currentEpoch][userStrike] += amount;
        // Add to total epoch strike deposits
        totalEpochStrikeDeposits[currentEpoch][strike] += amount;
        // Add to total epoch deposits
        totalEpochDeposits[currentEpoch] += amount;
        // Add to total epoch strike deposits
        totalEpochStrikeBalance[currentEpoch][strike] += amount;
        // Add to total epoch deposits
        totalEpochBalance[currentEpoch] += amount;

        emit NewDeposit(currentEpoch, strike, amount, user, msg.sender);

        return true;
    }

    /**
     * @notice Settle calculates the PnL for the user and withdraws the PnL in collateral asset to the user. Will also the burn the option tokens from the user.
     * @param strikeIndex Strike index
     * @param amount Amount of options
     * @param epoch The epoch
     * @return pnl
     */
    function settle(
        uint256 strikeIndex,
        uint256 amount,
        uint256 epoch
    ) external whenNotPaused returns (uint256 pnl) {
        require(isEpochExpired[epoch], "E");
        require(strikeIndex < epochStrikes[epoch].length, "E");
        require(amount > 0, "E");

        uint256 strike = epochStrikes[epoch][strikeIndex];
        require(strike != 0, "E");
        require(IERC20(epochStrikeTokens[epoch][strike]).balanceOf(msg.sender) >= amount, "E");

        // Calculate PnL (in DPX)
        pnl = calculatePnl(settlementPrices[epoch], strike, amount);

        require(pnl > 0, "E");

        IERC20 _erc20 = IERC20(collateralAsset);

        // Burn user option tokens
        VaultToken(epochStrikeTokens[epoch][strike]).burnFrom(msg.sender, amount);

        // Transfer PnL to user
        _erc20.safeTransfer(msg.sender, pnl);

        emit SettleOption(epoch, strike, msg.sender, amount, pnl);
    }

    /// @notice Calculate Pnl
    /// @param price price of collateral asset
    /// @param strike strike price of the the option
    /// @param amount amount of options
    function calculatePnl(
        uint256 price,
        uint256 strike,
        uint256 amount
    ) public pure returns (uint256) {
        return price > strike ? (((price - strike) * amount) / price) : 0;
    }

    /// @notice Sets the current epoch as expired.
    /// @return Whether expire was successful
    function expireEpoch(uint256 settlementPrice) external onlyOwner whenNotPaused returns (bool) {
        require(!isEpochExpired[currentEpoch], "E");
        require((block.timestamp > epochExpiry + expireDelayTolerance), "E");

        settlementPrices[currentEpoch] = settlementPrice;

        isEpochExpired[currentEpoch] = true;

        return true;
    }

    /**
     * @notice Withdraws balances for a strike in a completed epoch
     * @param withdrawEpoch Epoch to withdraw from
     * @param strikeIndex Index of strike
     * @return withdrawn amount
     */
    function withdrawCollateral(uint256 withdrawEpoch, uint256 strikeIndex) external whenNotPaused returns (uint256) {
        require(isEpochExpired[withdrawEpoch], "E");
        require(strikeIndex < epochStrikes[withdrawEpoch].length, "E");

        uint256 strike = epochStrikes[withdrawEpoch][strikeIndex];
        require(strike != 0, "E");

        bytes32 userStrike = keccak256(abi.encodePacked(msg.sender, strike));
        uint256 userStrikeDeposits = userEpochDeposits[withdrawEpoch][userStrike];
        require(userStrikeDeposits > 0, "E");

        // Transfer tokens to user
        uint256 pnl = calculatePnl(settlementPrices[withdrawEpoch], strike, userStrikeDeposits);
        uint256 userCollateralAmount = userStrikeDeposits - pnl;

        userEpochDeposits[withdrawEpoch][userStrike] = 0;

        IERC20(collateralAsset).safeTransfer(msg.sender, userCollateralAmount);

        emit NewWithdraw(withdrawEpoch, strike, msg.sender, userStrikeDeposits);

        return userCollateralAmount;
    }

    /**
     * @notice Returns a concatenated string of a and b
     * @param a string a
     * @param b string b
     */
    function concatenate(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }
}
