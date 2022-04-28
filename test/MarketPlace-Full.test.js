const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');

const e18 = 1 + '0'.repeat(18)
const e26 = 1 + '0'.repeat(26)
const e24 = 1 + '0'.repeat(24)

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000';
const tokenURIs = [
   'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk',
   'https://gateway.pinata.cloud/ipfs/QmRGyvR1PBhjBXmkMxrtHHfYH7uoctT7XAqkc1GiA52sBe',
   'https://gateway.pinata.cloud/ipfs/QmUgUiJNAPiH9sUhhkjrJxRcwhjchVsbzNdu5umrJgAEhk',
   'https://gateway.pinata.cloud/ipfs/QmTnH7cmFiQdWWpUnKMdUqEWZNVESrqbKUu8f496CCqe22',
   'https://gateway.pinata.cloud/ipfs/QmXXaQj5TTocKDdnDbYguUS4BiQDqrtKjHVPUdcYtUMmpU',
   'https://gateway.pinata.cloud/ipfs/QmPzY59ajxEEwVwMakqj7zkLMAMCEu4vUEvQATCuZ1CeLB'
]

const AUCTION_TYPE_SALE = 0;
const AUCTION_TYPE_NORMAL = 1;
const AUCTION_TYPE_TIME = 2;
const AUCTION_TYPE_SLIENT = 3;

const txFee = 2;

describe('MarketPlace', function () {
   before (async function () {
      [
         this.minter1,
         this.minter2,
         this.minter3,
         this.minter4,
         this.minter5,
         this.bider1,
         this.bider2,
         this.bider3,
         this.bider4,
         this.scammer,
         this.multisig
      ] = await ethers.getSigners();

      this.WETH = await deploy("ERC20Mock",'Wrapped ETH', 'WETH');
      this.revFactory = await deployProxy('RevFactory');
      this.saleNFT = await deployProxy('RevSale');
      this.revNFT = await deploy('RevNFT', 'Rev NFT', 'RNT', BigInt(10 ** 15));
      this.auction = await deployProxy('RevAuction');
      this.marketPlace = await deployProxy('MarketPlace');
      this.marketPlaceRouter = await deployProxy('MarketPlaceRouter');

      await this.marketPlaceRouter.setBasicData(
         this.marketPlace.address,
         this.auction.address,
         this.saleNFT.address,
         this.revNFT.address,
         this.revFactory.address
      );

      await this.marketPlace.setData(
         this.auction.address,
         this.saleNFT.address,
         this.revNFT.address,
         this.WETH.address
      );

      await this.marketPlace.setOwner(this.marketPlaceRouter.address);

      await this.auction.setOwner(
         this.marketPlace.address,
         this.marketPlaceRouter.address
      );
      await this.saleNFT.setOwner(
         this.marketPlace.address,
         this.marketPlaceRouter.address
      );

      await this.revNFT.setMarketplaceAddress(this.marketPlaceRouter.address);

      this.nftFactory = await ethers.getContractFactory('RevNFT');
      this.nft1 = await this.nftFactory.deploy('nft1', 'NFT1', bigNum('1'));
      await this.nft1.deployed();
      this.nft2 = await this.nftFactory.deploy('nft2', 'NFT2', bigNum('1'));
      await this.nft2.deployed();
      this.nft3 = await this.nftFactory.deploy('nft3', 'NFT3', bigNum('1'));
      await this.nft3.deployed();
      this.nft4 = await this.nftFactory.deploy('nft4', 'NFT4', bigNum('1'));
      await this.nft4.deployed();

      await this.WETH.approve(this.minter2.address, bigNum(10000000));
      await this.WETH.approve(this.minter3.address, bigNum(10000000));
      await this.WETH.approve(this.minter4.address, bigNum(10000000));
      await this.WETH.approve(this.minter5.address, bigNum(10000000));
      await this.WETH.approve(this.bider1.address, bigNum(10000000));
      await this.WETH.approve(this.bider2.address, bigNum(10000000));
      await this.WETH.approve(this.bider3.address, bigNum(10000000));
      await this.WETH.approve(this.bider4.address, bigNum(10000000));

      await this.WETH.transfer(this.minter2.address, bigNum(10000));
      await this.WETH.transfer(this.minter3.address, bigNum(10000));
      await this.WETH.transfer(this.minter4.address, bigNum(10000));
      await this.WETH.transfer(this.minter5.address, bigNum(10000));
      await this.WETH.transfer(this.bider1.address, bigNum(10000));
      await this.WETH.transfer(this.bider2.address, bigNum(10000));
      await this.WETH.transfer(this.bider3.address, bigNum(10000));
      await this.WETH.transfer(this.bider4.address, bigNum(10000));
   })

   it ('marketplace should have none NFT collection', async function () {
      const auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(auctionList.length).to.equal(0);
      const saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(0);
      const ownedList = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      expect(ownedList.length).to.equal(0);

      await this.marketPlaceRouter.addMultiSigWallet(this.multisig.address);
   })

   it ('get token infos when marketplace is empty', async function () {
      const allTokens = await this.marketPlaceRouter.getAllTokens();
      expect(allTokens.length).to.equal(0);

      const trendingList = await this.marketPlaceRouter.getTrendingList();
      expect(trendingList.length).to.equal(0);
   })

   it ('mint collection', async function () {
      for (let i = 0; i < 4; i ++) {
         await this.nft1.createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.nft2.connect(this.minter2).createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.nft3.connect(this.minter3).createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.nft4.connect(this.minter4).createNFT([tokenURIs[i]], {value: bigNum(1)});
      }
   })

   it ('get tokenURI', async function () {
      let tokenURI = await this.nft1.tokenURI(1);
      expect(tokenURI).to.be.equal(tokenURIs[1]);
   })

   it ('mint Rev NFT through the marketplace', async function () {
      await this.marketPlaceRouter.connect(this.minter5).mintNFT(
         tokenURIs[0], {value: ethers.utils.parseEther('0.001')}
      );

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter5.address);
      expect(tokens[tokens.length - 1].tokenAddress).to.equal(this.revNFT.address);

      const balance = await this.revNFT.balanceOf(this.minter5.address);
      expect(balance).to.equal(1);
   })

   it ('add NFT collection to marketplace', async function () {
      await this.marketPlaceRouter.addCollection(this.nft1.address, [0, 1, 2]);
      const ownedList = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      expect(ownedList.length).to.equal(3);

      const allTokens = await this.marketPlaceRouter.getAllTokens();
      expect(allTokens.length).to.equal(4);
   })

   it ('add NFT collection with wrong owner should be reverted', async function () {
      await expect(this.marketPlaceRouter.connect(this.minter2).addCollection(
         this.nft1.address, 
         [3, 4]
      )).to.be.revertedWith('not owner');
   })

   it ('add NFT collection already added should be reverted', async function () {
      await expect(this.marketPlaceRouter.addCollection(
         this.nft1.address, 
         [0, 1, 3]
      )).to.be.revertedWith('already added');
   })

   it ('add more NFT collection to marketplace', async function () {
      await this.marketPlaceRouter.connect(this.minter2).addCollection(
         this.nft2.address, 
         [0, 1, 2]
      );
      await this.marketPlaceRouter.connect(this.minter3).addCollection(
         this.nft3.address, 
         [0, 1, 2]
      );
      await this.marketPlaceRouter.connect(this.minter4).addCollection(
         this.nft4.address, 
         [0, 1, 2]
      );
      expect((await this.marketPlaceRouter.getTokensByOwner(this.minter2.address)).length).to.equal(3);
      expect((await this.marketPlaceRouter.getTokensByOwner(this.minter3.address)).length).to.equal(3);
      expect((await this.marketPlaceRouter.getTokensByOwner(this.minter4.address)).length).to.equal(3);
   })

   it ('set Royalty with not proper percent should be reverted', async function () {
      await expect(this.marketPlaceRouter.setRoyalty(400)).to.be.revertedWith(
         'not proper rate'
      );

      await expect(this.marketPlaceRouter.setRoyalty(11000)).to.be.revertedWith(
         'not proper rate'
      );
   })

   it ('set Royalty should be reverted if caller is not owner', async function () {
      await expect(this.marketPlaceRouter.connect(this.minter2).setRoyalty(11000)).to.be.revertedWith(
         'Ownable: caller is not the owner'
      );
   })

   it ('set Royalty should be succeed', async function () {
      await this.marketPlaceRouter.setRoyalty(600);
      expect(await this.marketPlaceRouter.getRoyalty()).to.equal(600);

   })

   it ('transfer batch NFT collection contains tokenID that not owned should be reverted', async function () {
      await this.nft1.setApprovalForAll(this.marketPlace.address, true);
      await expect(this.marketPlaceRouter.batchTransfer(
         this.minter5.address,
         [
            {
               tokenAddress: this.nft1.address,
               tokenID: 0
            },
            {
               tokenAddress: this.nft1.address,
               tokenID: 1
            },
            {
               tokenAddress: this.nft3.address,
               tokenID: 0
            },
         ]
      )).to.be.revertedWith('not token owner');
   })

   it ('transfer batch NFT collection contains not exist tokenID', async function () {
      await this.nft1.setApprovalForAll(this.marketPlace.address, true);
      await expect(this.marketPlaceRouter.batchTransfer(
         this.minter5.address,
         [
            {
               tokenAddress: this.nft1.address,
               tokenID: 0
            },
            {
               tokenAddress: this.nft1.address,
               tokenID: 1
            },
            {
               tokenAddress: this.nft1.address,
               tokenID: 3
            },
         ]
      )).to.be.revertedWith('not exist token');
   })

   it ('transfer batchNFT collection should be succeed', async function () {
      await this.nft1.setApprovalForAll(this.marketPlace.address, true);

      await this.marketPlaceRouter.batchTransfer(
         this.minter5.address,
         [
            {
               tokenAddress: this.nft1.address,
               tokenID: 0
            },
            {
               tokenAddress: this.nft1.address,
               tokenID: 1
            }
         ]
      );

      expect((await this.marketPlaceRouter.getTokensByOwner(this.minter1.address)).length).to.equal(1);
      expect((await this.marketPlaceRouter.getTokensByOwner(this.minter5.address)).length).to.equal(3);
   });

   it ('a person who not registered to blacklist can add self collection', async function() {
      await this.nft1.connect(this.scammer).createNFT([4], {value: bigNum(1)});
      await this.marketPlaceRouter.connect(this.scammer).addCollection(this.nft1.address,[4,]);
      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.scammer.address);

      expect(tokens.length).to.equal(1);
   })

   it ('addToBlacklist should be reverted if caller is not multisig wallet', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.bider2).addToBlackList(this.scammer.address)
      ).to.be.revertedWith('');
   })

   it ('a person who be added to blacklist can not trade', async function () {
      await this.nft2.connect(this.scammer).createNFT([4], {value: bigNum(1)});
      await this.marketPlaceRouter.connect(this.multisig).addToBlackList(this.scammer.address);

      await expect(
         this.marketPlaceRouter.connect(this.scammer).addCollection(this.nft2.address, [4])
      ).to.be.revertedWith('scam address');

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.scammer.address);

      expect(tokens.length).to.equal(1);
   })

   it ('list auction for sale from scammer address should be reverted', async function() {
      await expect(
         this.marketPlaceRouter.connect(this.scammer).listAuction(
            this.nft1.address,
            [0],
            AUCTION_TYPE_SALE,
            bigNum(2),
            0
         )    
      ).to.be.revertedWith('scam address');
   })

   it ('list auction should be reverted if not approved', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft2.address,
         [0],
         AUCTION_TYPE_SALE,
         bigNum(2),
         0
      )).to.be.revertedWith('not approved');
   })

   it ('list auction should be revereted if not token owner', async function () {
      await this.nft1.connect(this.minter5).approve(this.marketPlace.address, 0);
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft1.address,
         [0],
         AUCTION_TYPE_SALE,
         bigNum(2),
         0
      )).to.be.revertedWith('not token owner');
   })

   it ('list auction for sale', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 0);
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft2.address,
         [0],
         AUCTION_TYPE_SALE,
         bigNum(2),
         0)
      ).to.be.emit(this.auction, 'ListAuction')
      .withArgs(
         this.nft2.address,
         this.minter2.address,
         [0],
         bigNum(2),
         0,
         0
      );

      const auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(auctionList.length).to.equal(1);
      expect(auctionList[0].tokenIDs.length).to.equal(1);
      expect(auctionList[0].tokenIDs[0]).to.equal(0);
      expect(auctionList[0].bidders.length).to.equal(0);

      const ownedAuctionList = await this.marketPlaceRouter.getAuctionListByOwner(this.minter2.address);
      expect(ownedAuctionList.length).to.equal(1);
   })

   it ('list auction should be revereted if try to list double', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 0);
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listAuction(
            this.nft2.address,
            [0],
            AUCTION_TYPE_SALE,
            bigNum(2),
            0
      )).to.be.revertedWith(' already listed');
   })

   it ('close auction should be reverted if caller is scammer', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.scammer).closeAuction(1)
      ).to.be.revertedWith('scam address');
   })

   it ('close auction should be reverted if caller is not auction owner', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter1).closeAuction(1)
      ).to.be.revertedWith(' not have permission to close');
   })

   it ('close auction should be reverted if auctionID not exist', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter1).closeAuction(2)
      ).to.be.revertedWith(' not exist such auction');
   })

   it ('close auction for sale without any bidder', async function () {
      await this.marketPlaceRouter.connect(this.minter2).closeAuction(1);
   })

   it ('bidAuction should be reverted if bider is auction owner', async function() {
      await this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft2.address,
         [0],
         AUCTION_TYPE_SALE,
         bigNum(2),
         0
      );

      await expect(
         this.marketPlaceRouter.connect(this.minter2).bidAuction(
            1,
            bigNum(2)
         )
      ).to.be.revertedWith(' owner can not bid');
   })

   it ('bidAuction should be reverted if bid amount is not same to ask amount', async function() {
      await expect(
         this.marketPlaceRouter.connect(this.bider1).bidAuction(
            2,
            bigNum(3)
         )
      ).to.be.revertedWith(' not correct bid amount');
   })

   it ('bidAuction should be reverted if bid to closed auction', async function() {
      await expect(
         this.marketPlaceRouter.connect(this.bider1).bidAuction(
            1,
            bigNum(3)
         )
      ).to.be.revertedWith(' closed auction');
   })

   it ('bidAuction should be reverted if bid to not exist auction', async function() {
      await expect(
         this.marketPlaceRouter.connect(this.bider1).bidAuction(
            10,
            bigNum(3)
         )
      ).to.be.revertedWith(' not exist auction');
   })

   it ('bidAuction should be reverted if caller is scammer', async function() {
      await expect(
         this.marketPlaceRouter.connect(this.scammer).bidAuction(
            3,
            bigNum(3)
         )
      ).to.be.revertedWith('scam address');
   })

   it ('bidAuction for sale should be succeed', async function () {
      let oldBal = await this.WETH.balanceOf(this.minter2.address);
      oldBal = smallNum(oldBal);
      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(2));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         2,
         bigNum(2)
      );

      let ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.bider1.address);
      expect(ownedTokens.length).to.equal(1);
      expect(ownedTokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(ownedTokens[0].tokenID).to.equal(0);

      ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.minter2.address);
      expect(ownedTokens.length).to.equal(2);
      expect(ownedTokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(ownedTokens[1].tokenAddress).to.equal(this.nft2.address);
      expect(ownedTokens[0].tokenID).to.equal(1);
      expect(ownedTokens[1].tokenID).to.equal(2);

      let newBal = await this.WETH.balanceOf(this.minter2.address);
      const amount = smallNum(newBal) - oldBal;
      const royaltyRate = await this.marketPlaceRouter.getRoyalty();
      const royaltyFeeAmount = 2 * (royaltyRate / 10**5);
      const txFeeAmount = 2 * (2 / 100);
      let expectAmount = 2 - royaltyFeeAmount - txFeeAmount;
      expectAmount += royaltyFeeAmount;   // cuz origin owner gets royalty

      expect(amount.toFixed(2)).to.equal(expectAmount.toFixed(2));
   })

   it ('list normal Auction', async function () {
      const tokenID = 0;
      await this.nft3.connect(this.minter3).approve(this.marketPlace.address, tokenID);
      await expect(
         this.marketPlaceRouter.connect(this.minter3).listAuction(
         this.nft3.address,
         [tokenID],
         AUCTION_TYPE_NORMAL,
         bigNum(3),
         0
      )).to.be.emit(this.auction, 'ListAuction')
      .withArgs(this.nft3.address, this.minter3.address, [0], bigNum(3), 0, AUCTION_TYPE_NORMAL);
      this.auctionID = 2;
   })

   it ('bid to normal auction should be reverted if bid amount is less than min amount', async function () {
      const auctions = await this.marketPlaceRouter.getAuctionList();
      this.auctionID = auctions[auctions.length - 1].auctionID;
      await expect(
         this.marketPlaceRouter.connect(this.bider1).bidAuction(
            this.auctionID,
            bigNum(2)
         )
      ).to.be.revertedWith(' not meet floor price');
   })

   it ('bid to normal auction with higher price from same address', async function () {
      const auctions = await this.marketPlaceRouter.getAuctionList();
      this.auctionID = auctions[auctions.length - 1].auctionID;
      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(3));
      await expect(
         this.marketPlaceRouter.connect(this.bider1).bidAuction(
            this.auctionID,
            bigNum(3)
         )
      ).emit(this.auction, 'BidAuction')
      .withArgs(this.auctionID - 1, this.bider1.address, bigNum(3), AUCTION_TYPE_NORMAL);

      let biderInfo = await this.marketPlaceRouter.getBidderInfo(this.auctionID);
      expect(biderInfo.length).to.equal(1);
      expect(biderInfo[0].askPrice).to.equal(bigNum(3));
      expect(biderInfo[0].askPerson).to.equal(this.bider1.address);

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(5));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         this.auctionID,
         bigNum(5)
      );

      biderInfo = await this.marketPlaceRouter.getBidderInfo(this.auctionID);
      expect(biderInfo.length).to.equal(1);
      expect(biderInfo[0].askPrice).to.equal(bigNum(5));
      expect(biderInfo[0].askPerson).to.equal(this.bider1.address);
   })

   it ('bid to normal auction from several addresses', async function () {
      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(
         this.auctionID,
         bigNum(4)
      );

      await this.WETH.connect(this.bider3).approve(this.marketPlace.address, bigNum(7));
      await this.marketPlaceRouter.connect(this.bider3).bidAuction(
         this.auctionID,
         bigNum(7)
      );

      biderInfo = await this.marketPlaceRouter.getBidderInfo(this.auctionID);
      expect(biderInfo.length).to.equal(3);

      expect(biderInfo[0].askPrice).to.equal(bigNum(5));
      expect(biderInfo[0].askPerson).to.equal(this.bider1.address);

      expect(biderInfo[1].askPrice).to.equal(bigNum(4));
      expect(biderInfo[1].askPerson).to.equal(this.bider2.address);

      expect(biderInfo[2].askPrice).to.equal(bigNum(7));
      expect(biderInfo[2].askPerson).to.equal(this.bider3.address);
   })

   it ('close normal auction', async function () {
      let oldBal = await this.WETH.balanceOf(this.minter3.address);
      oldBal = smallNum(oldBal);

      await this.marketPlaceRouter.connect(this.minter3).closeAuction(this.auctionID);

      let newBal = await this.WETH.balanceOf(this.minter3.address);
      newBal = smallNum(newBal);

      const ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.bider3.address);
      expect(ownedTokens.length).to.equal(1);
      expect(ownedTokens[0].tokenAddress).to.equal(this.nft3.address);
      expect(ownedTokens[0].tokenID).to.equal(0);

      const amount = newBal - oldBal;
      const topPrice = 7;
      const royaltyRate = await this.marketPlaceRouter.getRoyalty();
      const royaltyFeeAmount = topPrice * (royaltyRate / 10**5);
      const txFeeAmount = topPrice * (2 / 100);
      let expectAmount = topPrice - royaltyFeeAmount - txFeeAmount;
      expectAmount += royaltyFeeAmount;   // cuz origin owner gets royalty

      expect(amount.toFixed(2)).to.equal(expectAmount.toFixed(2));
   })   

   it ('list normal auction with not origin owner to check royalty works correctly', async function () {
      const tokenID = 0;
      const minPrice = bigNum(3);

      let oldBal = await this.WETH.balanceOf(this.minter3.address);
      let oldBal_3 = await this.WETH.balanceOf(this.bider3.address);
      oldBal = smallNum(oldBal);
      oldBal_3 = smallNum(oldBal_3);

      await this.nft3.connect(this.bider3).approve(this.marketPlace.address, tokenID);
      await this.marketPlaceRouter.connect(this.bider3).listAuction(
         this.nft3.address,
         [tokenID],
         AUCTION_TYPE_NORMAL,
         BigInt(minPrice),
         0
      );

      const auctions = await this.marketPlaceRouter.getAuctionList();
      this.auctionID = auctions[auctions.length - 1].auctionID;
      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(this.auctionID, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider3).closeAuction(this.auctionID);

      let newBal = await this.WETH.balanceOf(this.minter3.address);
      let newBal_3 = await this.WETH.balanceOf(this.bider3.address);
      newBal = smallNum(newBal);
      newBal_3 = smallNum(newBal_3);

      const amount = newBal_3 - oldBal_3;
      const topPrice = 4;
      const royaltyRate = await this.marketPlaceRouter.getRoyalty();
      const royaltyFeeAmount = topPrice * (royaltyRate / 10**5);
      const txFeeAmount = topPrice * (2 / 100);
      let expectAmount = topPrice - royaltyFeeAmount - txFeeAmount;

      const amount_royalty = newBal - oldBal;

      expect(amount.toFixed(2)).to.equal(expectAmount.toFixed(2));
      expect(amount_royalty.toFixed(2)).to.equal(royaltyFeeAmount.toFixed(2));
   })

   it ('list auction for time should be reverted if time is zero', async function () {
      this.tokenID = 0; 
      const price = bigNum(4);
      const timeLimit = 1000 * 30;  // 30s     
      await expect(
         this.marketPlaceRouter.connect(this.minter5).listAuction(
            this.nft1.address,
            [this.tokenID],
            AUCTION_TYPE_TIME,
            price,
            0
         )
      ).to.be.revertedWith(' not allowed limit time');
   })

   it ('list auction for time should success', async function () {
      const price = bigNum(4);
      const timeLimit = 1000 * 30;  // 30s    
      await expect(
         this.marketPlaceRouter.connect(this.minter5).listAuction(
            this.nft1.address,
            [this.tokenID],
            AUCTION_TYPE_TIME,
            price,
            timeLimit
         )
      ).to.be.emit(this.auction, 'ListAuction')
      .withArgs(
         this.nft1.address,
         this.minter5.address,
         [this.tokenID],
         price,
         timeLimit,
         AUCTION_TYPE_TIME
      );
      this.auctionID ++;
   })

   it ('bid auction for time', async function () {
      const auctions = await this.marketPlaceRouter.getAuctionList();
      this.auctionID = auctions[auctions.length - 1].auctionID;

      await this.WETH.connect(this.bider3).approve(this.marketPlace.address, bigNum(5));
      await this.marketPlaceRouter.connect(this.bider3).bidAuction(this.auctionID, bigNum(5));
      await this.WETH.connect(this.bider4).approve(this.marketPlace.address, bigNum(7));
      await this.marketPlaceRouter.connect(this.bider4).bidAuction(this.auctionID, bigNum(7));
   })

   it ('close auction should be reverted if request close the not finished auction', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter5).closeAuction(this.auctionID)
      ).to.be.revertedWith(' not finished');
   }) 

   it ('bid auction should be reverted if the auction is time out', async function () {
      await network.provider.send("evm_increaseTime", [1000 * 40]);
      await network.provider.send("evm_mine");

      await expect(
         this.marketPlaceRouter.connect(this.bider2).bidAuction(this.auctionID, bigNum(9))
      ).to.be.revertedWith(' time out');
   })

   it ('close auction for time', async function() {
      let oldBal = await this.WETH.balanceOf(this.minter1.address);
      let oldBal_5 = await this.WETH.balanceOf(this.minter5.address);

      oldBal = smallNum(oldBal);
      oldBal_5 = smallNum(oldBal_5);

      await this.marketPlaceRouter.connect(this.minter5).closeAuction(this.auctionID);      

      let ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.bider4.address);
      expect(ownedTokens.length).to.equal(1);      
      expect(ownedTokens[0].tokenAddress).to.equal(this.nft1.address);
      expect(ownedTokens[0].tokenID).to.equal(this.tokenID);

      ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.minter5.address);
      expect(ownedTokens.length).to.equal(2);      
      expect(ownedTokens[0].tokenID).to.equal(0);

      let newBal = await this.WETH.balanceOf(this.minter1.address);
      let newBal_5 = await this.WETH.balanceOf(this.minter5.address);

      newBal = smallNum(newBal);
      newBal_5 = smallNum(newBal_5);

      const amount = newBal_5 - oldBal_5;
      const topPrice = 7;
      const royaltyRate = await this.marketPlaceRouter.getRoyalty();
      const royaltyFeeAmount = topPrice * (royaltyRate / 10**5);
      const txFeeAmount = topPrice * (2 / 100);
      let expectAmount = topPrice - royaltyFeeAmount - txFeeAmount;

      const amount_royalty = newBal - oldBal;

      expect(amount.toFixed(2)).to.equal(expectAmount.toFixed(2));
      expect(amount_royalty.toFixed(2)).to.equal(royaltyFeeAmount.toFixed(2));      
   })

   it ('list auction for slient should be succeed', async function () {
      const price = bigNum(4);
      const timeLimit = 1000 * 30;  // 30s    
      this.tokenID = 1;
      await this.nft3.connect(this.minter3).approve(this.marketPlace.address, this.tokenID);
      await expect(
         this.marketPlaceRouter.connect(this.minter3).listAuction(
            this.nft3.address,
            [this.tokenID],
            AUCTION_TYPE_SLIENT,
            price,
            timeLimit
         )
      ).to.be.emit(this.auction, 'ListAuction')
      .withArgs(
         this.nft3.address,
         this.minter3.address,
         [this.tokenID],
         price,
         timeLimit,
         AUCTION_TYPE_SLIENT
      );
      this.auctionID ++;
   })

   it ('bidders of auction for slient can not show the bidders', async function () {
      await this.WETH.connect(this.bider3).approve(this.marketPlace.address, bigNum(5));
      await this.marketPlaceRouter.connect(this.bider3).bidAuction(this.auctionID, bigNum(5));
      const bidders = await this.marketPlaceRouter.getBidderInfo(this.auctionID);
      expect(bidders.length).to.equal(0);

      await network.provider.send("evm_increaseTime", [1000 * 40]);
      await network.provider.send("evm_mine");
      await this.marketPlaceRouter.connect(this.minter3).closeAuction(this.auctionID);
   })

   it ('bidBundleAuction should be reverted if there is different owner', async function () {
      await this.nft2.connect(this.bider1).createNFT([tokenURIs[4]], {value: bigNum(1)});      
      await this.marketPlaceRouter.connect(this.bider1).addCollection(this.nft2.address, [5]);

      await this.nft2.connect(this.bider1).approve(this.marketPlace.address, 0);
      await this.nft2.connect(this.bider1).approve(this.marketPlace.address, 5);

      await expect(
         this.marketPlaceRouter.connect(this.bider1).listAuction(
            this.nft2.address,
            [5, 0],
            AUCTION_TYPE_SALE,
            bigNum(2),
            0
         )
      ).to.be.revertedWith('not same owner');

      await expect(
         this.marketPlaceRouter.connect(this.bider1).listAuction(
            this.nft2.address,
            [5, 0],
            AUCTION_TYPE_NORMAL,
            bigNum(2),
            0
         )
      ).to.be.revertedWith('not same owner');

      await expect(
         this.marketPlaceRouter.connect(this.bider1).listAuction(
            this.nft2.address,
            [5, 0],
            AUCTION_TYPE_TIME,
            bigNum(2),
            0
         )
      ).to.be.revertedWith('not same owner');

      await expect(
         this.marketPlaceRouter.connect(this.bider1).listAuction(
            this.nft2.address,
            [5, 0],
            AUCTION_TYPE_SLIENT,
            bigNum(2),
            0
         )
      ).to.be.revertedWith('not same owner');
   })

   it ('list bundle auction for sale and close', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 1);
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 2);

      await this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft2.address,
         [1, 2],
         AUCTION_TYPE_SALE,
         bigNum(4),
         0
      );

      this.auctionID ++;

      await this.WETH.connect(this.bider3).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider3).bidAuction(this.auctionID, bigNum(4));

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider3.address);
      expect(tokens.length).to.equal(3);

      expect(tokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[0].tokenID).to.equal(1);

      expect(tokens[1].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[1].tokenID).to.equal(2);
   })

   it ('list bundle general auction and close', async function () {
      await this.nft2.connect(this.bider3).approve(this.marketPlace.address, 1);
      await this.nft2.connect(this.bider3).approve(this.marketPlace.address, 2);

      await this.marketPlaceRouter.connect(this.bider3).listAuction(
         this.nft2.address,
         [1, 2],
         AUCTION_TYPE_NORMAL,
         bigNum(4),
         0
      );

      this.auctionID ++;

      await this.WETH.connect(this.minter1).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(this.auctionID, bigNum(4));
      await this.WETH.connect(this.minter2).approve(this.marketPlace.address, bigNum(7));
      await this.marketPlaceRouter.connect(this.minter2).bidAuction(this.auctionID, bigNum(7));

      await this.marketPlaceRouter.connect(this.bider3).closeAuction(this.auctionID);

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter2.address);
      expect(tokens.length).to.equal(2);

      expect(tokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[0].tokenID).to.equal(1);

      expect(tokens[1].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[1].tokenID).to.equal(2);
   })

   it ('list bundle auction for time and close', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 1);
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, 2);

      await this.marketPlaceRouter.connect(this.minter2).listAuction(
         this.nft2.address,
         [1, 2],
         AUCTION_TYPE_TIME,
         bigNum(4),
         1000 * 30
      );

      this.auctionID ++;
      await this.WETH.connect(this.bider3).approve(this.marketPlace.address, bigNum(7));
      await this.marketPlaceRouter.connect(this.bider3).bidAuction(this.auctionID, bigNum(7));
      await this.WETH.connect(this.bider4).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(this.auctionID, bigNum(4));

      await network.provider.send("evm_increaseTime", [40 * 1000]);
      await network.provider.send("evm_mine");

      await this.marketPlaceRouter.connect(this.minter2).closeAuction(this.auctionID);

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider3.address);
      expect(tokens.length).to.equal(3);

      expect(tokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[0].tokenID).to.equal(1);

      expect(tokens[1].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[1].tokenID).to.equal(2);
   })

   it ('list bundle auction for silent and close', async function () {
      await this.nft2.connect(this.bider3).approve(this.marketPlace.address, 1);
      await this.nft2.connect(this.bider3).approve(this.marketPlace.address, 2);

      await this.marketPlaceRouter.connect(this.bider3).listAuction(
         this.nft2.address,
         [1, 2],
         AUCTION_TYPE_SLIENT,
         bigNum(4),
         1000 * 30
      );

      this.auctionID ++;

      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(this.auctionID, bigNum(4));
      await this.WETH.connect(this.minter2).approve(this.marketPlace.address, bigNum(7));
      await this.marketPlaceRouter.connect(this.minter2).bidAuction(this.auctionID, bigNum(7));

      await network.provider.send("evm_increaseTime", [40 * 1000]);
      await network.provider.send("evm_mine");

      await this.marketPlaceRouter.connect(this.bider3).closeAuction(this.auctionID);

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter2.address);
      expect(tokens.length).to.equal(2);

      expect(tokens[0].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[0].tokenID).to.equal(1);

      expect(tokens[1].tokenAddress).to.equal(this.nft2.address);
      expect(tokens[1].tokenID).to.equal(2);
   })

   it ('list nft for sale with zero price should be reverted', async function () {
      this.tokenID = 1;
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listNFTForSale(
            this.nft2.address,
            [this.tokenID],
            0
         )
      ).to.be.revertedWith('incorrect info');
   })
   
   it ('list nft for sale with not approved nft should be reverted', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter2).listNFTForSale(
            this.nft2.address,
            [this.tokenID],
            bigNum(2)
         )
      ).to.be.revertedWith('not approved');
   })

   it ('list nft for sale', async function () {
      await this.nft2.connect(this.minter2).approve(this.marketPlace.address, this.tokenID);

      await expect(
         this.marketPlaceRouter.connect(this.minter2).listNFTForSale(
            this.nft2.address,
            [this.tokenID],
            bigNum(2)
         )
      ).to.be.emit(this.saleNFT, 'ListNFTForSale')
      .withArgs(
         this.minter2.address,
         [this.tokenID],
         bigNum(2)
      );

      this.sellID = 0;

      const saleTokens = await this.marketPlaceRouter.getSaleTokensByOwner(this.minter2.address);
      expect(saleTokens.length).to.equal(1);
   })

   it ('buy nft with incorrect amount should be reverted', async function () {
      let saleInfos = await this.marketPlaceRouter.getTokensForSale();
      this.sellID = saleInfos[saleInfos.length - 1].sellID;
      await expect(
         this.marketPlaceRouter.connect(this.bider4).buyNFTs(
            this.sellID,
            {value: 0}
         )
      ).to.be.revertedWith('sale: not correct cost');
   })

   it ('buy nft with incorrect sellID should be reverted', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.bider4).buyNFTs(
            this.sellID + 1,
            {value: bigNum(3)}
         )
      ).to.be.revertedWith('sale: not correct sellID');
   })

   it ('buy nft with sale owner should be reverted', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.minter2).buyNFTs(
            this.sellID,
            {value: bigNum(2)}
         )
      ).to.be.revertedWith('sale: sale owner');
   })

   it ('buy nft.', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.bider4).buyNFTs(
            this.sellID,
            {value: bigNum(2)}
         )
      ).to.be.emit(this.saleNFT, 'BuyNFT')
      .withArgs(
         this.minter2.address,
         this.bider4.address,
         this.nft2.address,
         [this.tokenID],
         bigNum(2)
      );

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider4.address);
      expect(tokens.length).to.equal(2);
   })

   it ('list a bundle of nfts for sale', async function () {
      await this.nft4.connect(this.minter4).approve(this.marketPlace.address, 0);
      await this.nft4.connect(this.minter4).approve(this.marketPlace.address, 1);
      await this.nft4.connect(this.minter4).approve(this.marketPlace.address, 2);

      await expect(
         this.marketPlaceRouter.connect(this.minter4).listNFTForSale(
            this.nft4.address,
            [0, 1, 2],
            bigNum(4)
         )
      ).to.be.emit(this.saleNFT, 'ListNFTForSale')
      .withArgs(
         this.minter4.address,
         [0, 1, 2],
         bigNum(4)
      );

      this.sellID ++;

      const saleTokens = await this.marketPlaceRouter.getSaleTokensByOwner(this.minter4.address);
      expect(saleTokens.length).to.equal(1);
   })

   it ('buy bundle nft.', async function () {
      await expect(
         this.marketPlaceRouter.connect(this.bider3).buyNFTs(
            this.sellID,
            {value: bigNum(4)}
         )
      ).to.be.emit(this.saleNFT, 'BuyNFT')
      .withArgs(
         this.minter4.address,
         this.bider3.address,
         this.nft4.address,
         [0, 1, 2],
         bigNum(4)
      );

      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.bider3.address);
      expect(tokens.length).to.equal(4);
   })

   it ('get trending list', async function () {
      const trendingList = await this.marketPlaceRouter.getTrendingList();
      for (let i = 0; i < trendingList.length - 1; i ++) {
         expect(smallNum(trendingList[i].tradePrice)).to.be.greaterThanOrEqual(smallNum(trendingList[i + 1].tradePrice));
      }
   })

   it ('list auction and sale at once', async function () {
      await this.marketPlaceRouter.connect(this.minter1).listNFTForSale(
         this.nft1.address,
         [2],
         bigNum(2)
      );

      await this.marketPlaceRouter.connect(this.minter1).listAuction(
         this.nft1.address,
         [2],
         AUCTION_TYPE_NORMAL,
         0,
         0
      );
   })

   it ('buy NFT and check the auction status', async function () {
      const saleList = await this.marketPlaceRouter.getTokensForSale();
      let auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(auctionList.length).to.equal(1);
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(saleList[0].sellID, {value: bigNum(2)});
      auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(auctionList.length).to.equal(0);
   })

   it ('list auction and sale at once', async function () {
      await this.nft1.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await expect(
         this.marketPlaceRouter.connect(this.bider1).listAuction(
            this.nft1.address,
            [2],
            AUCTION_TYPE_NORMAL,
            0,
            0
         )
      ).to.be.revertedWith('incorrect info');

      await this.marketPlaceRouter.connect(this.bider1).listAuction(
         this.nft1.address,
         [2],
         AUCTION_TYPE_NORMAL,
         bigNum(2),
         0
      );

      await this.marketPlaceRouter.connect(this.bider1).listNFTForSale(
         this.nft1.address,
         [2],
         bigNum(3)
      );
   })

   it ('buy NFT and check the auction status', async function () {
      let saleList = await this.marketPlaceRouter.getTokensForSale();
      let auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(saleList.length).to.equal(1);
      await this.WETH.connect(this.minter1).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.minter1).bidAuction(auctionList[0].auctionID, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider1).closeAuction(auctionList[0].auctionID);

      saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(0);
   })

   it ('list auction and sale and check price', async function () {
      await this.nft1.connect(this.minter1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.minter1).listNFTForSale(
         this.nft1.address,
         [2],
         bigNum(2)
      );

      await this.marketPlaceRouter.connect(this.minter1).listAuction(
         this.nft1.address,
         [2],
         AUCTION_TYPE_NORMAL,
         bigNum(3),
         0
      );

      const auctionList = await this.marketPlaceRouter.getAuctionList();
      expect(auctionList[0].price).to.equal(bigNum(3));
   })

   it ('create collection', async function () {
      await this.marketPlaceRouter.createCollection(
         'Test',
         'TEST',
         tokenURIs[0],
         10 ** 15
      );
   })

   it ('get price history', async function () {
      const priceHistory = await this.marketPlaceRouter.getPriceHistory(
         this.nft1.address,
         0
      );
      expect(priceHistory.length).to.equal(1);
      expect(smallNum(priceHistory[0].price)).to.equal(7);
   })

   describe ('Withdraw', function () {
      it ('get balance stored in marketplace', async function () {
         this.balance = await ethers.provider.getBalance(this.marketPlace.address);
         this.balance = smallNum(this.balance);
         expect(this.balance).to.be.greaterThan(0);
      })
   
      it ('withdraw should be reverted if marketplace not paused', async function () {
         await expect(
            this.marketPlaceRouter.connect(this.minter2).withDraw()
         ).to.be.revertedWith('Pausable: not paused');
      })

      it ('pause should be reverted if caller is not multisig', async function () {
         await expect(this.marketPlaceRouter.connect(this.bider1).pause()).to.be.revertedWith('');
      })

      it ('withdraw should be reverted if caller is not owner', async function () {
         await this.marketPlaceRouter.connect(this.multisig).pause();
         await expect(
            this.marketPlaceRouter.connect(this.minter2).withDraw()
         ).to.be.revertedWith('Ownable: caller is not the owner');
      })

      it ('withDraw should be succeed is caller is owner', async function () {
         let oldBal = await ethers.provider.getBalance(this.minter1.address);
         oldBal = smallNum(oldBal);
         this.balance = await ethers.provider.getBalance(this.marketPlace.address);
         await this.marketPlaceRouter.connect(this.minter1).withDraw();

         let newBal = await ethers.provider.getBalance(this.minter1.address);
         newBal = smallNum(newBal);
         this.balance = smallNum(this.balance);

         expect (Number((newBal - oldBal).toFixed(2))).to.equal(this.balance);
      })
   })
})

