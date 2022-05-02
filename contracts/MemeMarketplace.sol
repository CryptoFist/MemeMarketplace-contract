// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";

import "./interfaces/IMemeStrategyManager.sol";
import "./interfaces/ITransferManagerNFT.sol";
import "./interfaces/IMeme721.sol";
import "./interfaces/IMeme1155.sol";
import "./libraries/OrderType.sol";
import "./libraries/SignatureChecker.sol";

contract MemeMarketplace is Ownable, AccessControlEnumerable, ReentrancyGuard {
   using SafeERC20 for IERC20;

   IERC20 public immutable WETH;
   IMemeStrategyManager private strategyManager;
   address private ERC721Manager;
   address private ERC1155Manager;
   address private meme721;
   address private meme1155;
   address private fundAddress;

   mapping(address => mapping(uint256 => address)) private royaltyReceiver;

   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
   bytes32 public constant MODERATE_ROLE = keccak256("MODERATE_ROLE");
   bytes32 public immutable DOMAIN_SEPARATOR;

   uint256 public meme721Price = 1e15;
   uint256 public meme1155Price = 1e15;

   // ERC721 interfaceID
   bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;
   // ERC1155 interfaceID
   bytes4 public constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

   uint16 private ROYALTY_MIN = 5 * 1e2;     // over 1e3, 500 means 0.5%
   uint16 private ROYALTY_MAX = 1 * 1e4;     // over 1e3, 10000 means 10%
   uint16 private TX_FEE = 2 * 1e3;          // over 1e3, 2000 means 2%
   uint16 private royaltyRate = ROYALTY_MIN;   // over 1e3, 500 means 0.5%

   constructor(
      address strategyManager_,
      address ERC721Manager_,
      address ERC1155Manager_,
      address ERC721Address_,
      address ERC1155Address_,
      address WETH_,
      address multisig_
   ) {
      strategyManager = IMemeStrategyManager(strategyManager_);
      ERC721Manager = ERC721Manager_;
      ERC1155Manager = ERC1155Manager_;
      meme721 = ERC721Address_;
      meme1155 = ERC1155Address_;
      WETH = IERC20(WETH_);
      fundAddress = msg.sender;
      // Calculate the domain separator
      DOMAIN_SEPARATOR = keccak256(
         abi.encode(
               0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f, // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
               0x4fc79a4245e4aacb07164aa0d7b9e2449d3663f61446b7a4ff0af619df668406, // keccak256("MemeMarketplace")
               0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1")) for versionId = 1
               block.chainid,
               address(this)
         )
      );

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

   function setMeme721Price(uint256 newPrice_) external onlyOwner {
      meme721Price = newPrice_;
   }

   function setMeme1155Price(uint256 newPrice_) external onlyOwner {
      meme1155Price = newPrice_;
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

   function addCollection(
      address owner_,
      address tokenAddress_, 
      uint256[] memory tokenIDs_
   ) public {
      checkScammer();
      if (msg.sender != meme721 && msg.sender != meme1155) {
        require (owner_ == msg.sender, 'wrong user') ;
      }

      for (uint256 i = 0; i < tokenIDs_.length; i ++) {
         require (royaltyReceiver[tokenAddress_][tokenIDs_[i]] == address(0), 'already added');
         royaltyReceiver[tokenAddress_][tokenIDs_[i]] = owner_;
      }
   }

   function removeCollection(
      address tokenAddress_, 
      uint256[] calldata tokenIDs_
   ) external {
      checkPermission();
      for (uint256 i = 0; i < tokenIDs_.length; i ++) {
         royaltyReceiver[tokenAddress_][tokenIDs_[i]] = address(0);
      }
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

   function mintMeme721(
      string[] calldata tokenURIs_
   ) external payable {
      uint256 amount = tokenURIs_.length;
      require(amount > 0, "Amount must be greater than zero");
      require(amount * meme721Price <= msg.value, 'not enough money');

      IMeme721(meme721).mintNFT(tokenURIs_, msg.sender);
   }

   function mintMeme1155(
      string calldata tokenURI_,
      uint256 amount_
   ) external payable {
      require(amount_ > 0, "Amount must be greater than zero");
      require(amount_ * meme1155Price <= msg.value, 'not enough money');

      IMeme1155(meme1155).mintNFT(msg.sender, tokenURI_, amount_);
   }

   function buyNonFindgibleToken(
      OrderType.MakerOrder calldata maker_
   ) external payable nonReentrant {
      checkScammer();
      require (msg.value >= maker_.price, 'not enough money');
      _matchMakerWithTakerByETHAndWETH(maker_, msg.sender, true);
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
      } else if (IERC165(tokenAddress_).supportsInterface(INTERFACE_ID_ERC1155)) {
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
         maker_.s,
         DOMAIN_SEPARATOR
      );
   }
}