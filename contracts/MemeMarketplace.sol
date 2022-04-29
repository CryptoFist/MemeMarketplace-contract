// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IMemeCurrencyManager.sol";
import "./interfaces/IMemeStrategyManager.sol";
import "./interfaces/ITransferManagerNFT.sol";
import "./libraries/OrderType.sol";
import "./libraries/SignatureChecker.sol";

contract MemeMarketplace is Ownable, AccessControlEnumerable, ReentrancyGuard {
   using SafeERC20 for IERC20;

   IERC20 public immutable WETH;
   IMemeCurrencyManager private currencyManager;
   IMemeStrategyManager private strategyManager;
   address private ERC721Manager;
   address private ERC1155Manager;
   address private fundAddress;

   mapping(address => mapping(uint256 => address)) private royaltyReceiver;

   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
   bytes32 public constant MODERATE_ROLE = keccak256("MODERATE_ROLE");

   // ERC721 interfaceID
    bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    // ERC1155 interfaceID
    bytes4 public constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    uint16 private ROYALTY_MIN = 5 * 1e2;     // over 1e3, 500 means 0.5%
    uint16 private ROYALTY_MAX = 1 * 1e4;     // over 1e3, 10000 means 10%
    uint16 private TX_FEE = 2 * 1e3;          // over 1e3, 2000 means 2%
    uint16 private royaltyRate = ROYALTY_MIN;   // over 1e3, 500 means 0.5%

   constructor(
      address currencyManager_,
      address strategyManager_,
      address ERC721Manager_,
      address ERC1155Manager_,
      address WETH_,
      address multisig_
   ) {
      currencyManager = IMemeCurrencyManager(currencyManager_);
      strategyManager = IMemeStrategyManager(strategyManager_);
      ERC721Manager = ERC721Manager_;
      ERC1155Manager = ERC1155Manager_;
      WETH = IERC20(WETH_);
      fundAddress = msg.sender;
      _setupRole(OWNER_ROLE, msg.sender);
      _setupRole(OWNER_ROLE, multisig_);
   }

   function checkPermission() internal view {
      address sender = msg.sender;
      require (hasRole(OWNER_ROLE, sender) || hasRole(MODERATE_ROLE, sender), 'no permission');
   }

   function checkScammer() internal view {
      require (strategyManager.isStrategyblacklisted(msg.sender) == false, 'scammer address');
   }

   function setRoyaltyReceiver(
      address owner_,
      address tokenAddress_,
      uint256 tokenID_
   ) external onlyRole(OWNER_ROLE) {
      royaltyReceiver[tokenAddress_][tokenID_] = owner_;
   }

   function setFundAddress(address fundAddress_) external onlyRole(OWNER_ROLE) {
      fundAddress = fundAddress_;
   }

   function addToBlackList(address user_) external {
      checkPermission();
      strategyManager.addStrategy(user_);
   }

   function removeFromBlackList(address user_) external {
      checkPermission();
      strategyManager.removeStrategy(user_);
   }

   function addCollection(address tokenAddress_) external {
      checkScammer();
      currencyManager.addCurrency(tokenAddress_);
   }

   function removeCollection(address tokenAddress_) external {
      checkPermission();
      currencyManager.removeCurrency(tokenAddress_);
   }

   /**
   @dev set royalty of NFT. 0.5% <= royalty <= 10%
    */
   function setRoyalty(uint16 royalty_) external onlyRole(OWNER_ROLE) {
      require (royalty_ >= ROYALTY_MIN && royalty_ <= ROYALTY_MAX, 'not proper rate');
      royaltyRate = royalty_;
   }

   function getRoyalty() external view returns(uint16) {
      return royaltyRate;
   }

   function buyNonFindgibleToken(
      OrderType.MakerOrder calldata maker_,
      address taker_
   ) external payable nonReentrant {
      checkScammer();
      require (msg.value >= maker_.price, 'not enough money');
      _matchMakerWithTakerByETHAndWETH(maker_, taker_, true);
   }

   function closeAuction(
      OrderType.MakerOrder calldata maker_,
      address taker_
   ) external nonReentrant {
      checkScammer();
      _matchMakerWithTakerByETHAndWETH(maker_, taker_, false);
   }

   function acceptOffer(
      OrderType.MakerOrder calldata maker_,
      OrderType.MakerOrder calldata taker_
   ) external nonReentrant {
      checkScammer();
      _matchMakerWithTakerByETHAndWETH(maker_, taker_.maker, false);
      _matchMakerWithTakerByETHAndWETH(taker_, maker_.maker, false);
   }

   function _matchMakerWithTakerByETHAndWETH(
      OrderType.MakerOrder calldata maker_,
      address taker_,
      bool isETH_
   ) internal {
      bytes32 hash = OrderType.hash(maker_);
      _validateOrder(maker_, hash);

      if (maker_.price > 0) {
         _transferFeesAndFunds(
            maker_.maker, 
            royaltyReceiver[maker_.tokenAddress][maker_.tokenID], 
            maker_.price, 
            isETH_
         );
      }

      if (maker_.tokenAddress != address(0)) {
         _transferNonFundgibleToken(
            maker_.maker, 
            taker_, 
            maker_.tokenAddress, 
            maker_.tokenID, 
            maker_.tokenAmount
         );
      }
   }

   function _transferFeesAndFunds(
      address to_,
      address tokenOwner_,
      uint256 amount_,
      bool isETH_
   ) internal {
      uint256 royaltyFee = amount_ * royaltyRate / 1e5;  
      uint256 txFee = amount_ * TX_FEE / 1e5;
      amount_ = amount_ - royaltyFee - txFee;

      if (isETH_) {
         payable(to_).transfer(amount_);
         payable(tokenOwner_).transfer(royaltyFee);
      } else {
         WETH.safeTransfer(to_, amount_);
         WETH.safeTransfer(tokenOwner_, royaltyFee);
      }
   }

   function _transferNonFundgibleToken(
      address from_,
      address to_,
      address tokenAddress_,
      uint256 tokenID_,
      uint256 tokenAmount_
   ) internal {
      ITransferManagerNFT manager;
      if (IERC165(tokenAddress_).supportsInterface(INTERFACE_ID_ERC721)) {
         manager = ITransferManagerNFT(ERC721Manager);
         require (tokenAmount_ == 1, 'wrong amount');
      } else if (IERC165(tokenAddress_).supportsInterface(INTERFACE_ID_ERC721)) {
         manager = ITransferManagerNFT(ERC1155Manager);
      } else {
         revert("not Non Fundgible Token");
      }

      manager.transferNonFungibleToken(tokenAddress_, from_, to_, tokenID_, tokenAmount_);
   }

   function _validateOrder(
      OrderType.MakerOrder calldata maker_,
      bytes32 orderHash_
   ) internal view {
      require (maker_.maker != address(0), 'wrong maker');

      SignatureChecker.verify(
         orderHash_, 
         maker_.maker, 
         maker_.v, 
         maker_.r, 
         maker_.s
      );
   }
}