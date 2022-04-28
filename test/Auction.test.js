const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');

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

describe('MarketPlace: Auction', function () {
   before (async function () {
      [
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
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

      this.nftFactory = await ethers.getContractFactory('TestNFT');
      this.nft1 = await this.nftFactory.deploy('nft1', 'NFT1', bigNum('1'));
      await this.nft1.deployed();
      this.nft2 = await this.nftFactory.deploy('nft2', 'NFT2', bigNum('1'));
      await this.nft2.deployed();

      await this.WETH.approve(this.minter2.address, bigNum(10000000));
      await this.WETH.approve(this.bider1.address, bigNum(10000000));
      await this.WETH.approve(this.bider2.address, bigNum(10000000));

      await this.WETH.transfer(this.minter2.address, bigNum(10000));
      await this.WETH.transfer(this.bider1.address, bigNum(10000));
      await this.WETH.transfer(this.bider2.address, bigNum(10000));
   })

   it ('mint collection', async function () {
      for (let i = 0; i < 4; i ++) {
         await this.nft1.createNFT([tokenURIs[i]], {value: bigNum(1)});
         await this.nft2.connect(this.minter2).createNFT([tokenURIs[i]], {value: bigNum(1)});
      }
   })
   it ('check forAuction after listed NFT for auction', async function () {
      const price = bigNum(4);
      const timeLimit = 1000 * 30;  // 30s    
      this.tokenID = 0;
      this.auctionID = 0;
      await this.marketPlaceRouter.addCollection(this.nft1.address, [this.tokenID]);
      await this.nft1.connect(this.minter1).approve(this.marketPlace.address, this.tokenID);
      await this.marketPlaceRouter.connect(this.minter1).listAuction(
         this.nft1.address,
         [this.tokenID],
         AUCTION_TYPE_SALE,
         price,
         timeLimit
      );
      
      const tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens.length).to.equal(1);
      expect(tokens[0].forSale).to.equal(false);
      expect(tokens[0].forAuction).to.equal(true);
   })

   it ('bid to auction and close it', async function () {
      const auctions = await this.marketPlaceRouter.getAuctionList();
      this.auctionID = auctions[0].auctionID;

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         this.auctionID,
         bigNum(4)
      );

      const tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens[0].forAuction).to.equal(false);
      expect(tokens[0].price).to.equal(bigNum('4'));
   })

   it ('check forAuction after listed NFT for auction of general', async function () {
      this.tokenID ++;
      this.auctionID ++;
      const price = bigNum(4);
      const timeLimit = 1000 * 30;  // 30s    
      await this.marketPlaceRouter.addCollection(this.nft1.address, [this.tokenID]);
      await this.nft1.connect(this.minter1).approve(this.marketPlace.address, this.tokenID);
      await this.marketPlaceRouter.connect(this.minter1).listAuction(
         this.nft1.address,
         [this.tokenID],
         AUCTION_TYPE_NORMAL,
         price,
         timeLimit
      );

      const tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens.length).to.equal(2);
      expect(tokens[0].forSale).to.equal(false);
      expect(tokens[0].forAuction).to.equal(false);
      expect(tokens[1].forSale).to.equal(false);
      expect(tokens[1].forAuction).to.equal(true);
   })

   it ('bid to auction and close it', async function () {
      const auctionInfos = await this.marketPlaceRouter.getAuctionList();

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(6));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         auctionInfos[0].auctionID,
         bigNum(6)
      );

      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(
         auctionInfos[0].auctionID,
         bigNum(4)
      );

      let tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens[0].forAuction).to.equal(false);
      expect(tokens[0].price).to.equal(bigNum('4'));
      expect(tokens[1].forAuction).to.equal(true);

      const details = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      expect(details.forAuction).to.equal(true);
      expect(details.bidders.length).to.equal(2);

      await this.marketPlaceRouter.closeAuction(this.auctionID);
      tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens[0].forAuction).to.equal(false);
      expect(tokens[0].price).to.equal(bigNum('4'));
      expect(tokens[1].forAuction).to.equal(false);
      expect(tokens[1].price).to.equal(bigNum('6'));
   })

   it ('trade NFT one more and check trade price', async function () {
      const price = bigNum(6);
      const timeLimit = 1000 * 30;  // 30s    
      this.tokenID = 0;
      this.auctionID ++;
      await this.nft1.connect(this.bider1).approve(this.marketPlace.address, this.tokenID);
      await this.marketPlaceRouter.connect(this.bider1).listAuction(
         this.nft1.address,
         [this.tokenID],
         AUCTION_TYPE_SALE,
         price,
         timeLimit
      );

      await this.WETH.connect(this.minter1).approve(this.marketPlace.address, bigNum(6));
      await this.marketPlaceRouter.connect(this.minter1).bidAuction(
         this.auctionID,
         bigNum(6)
      );
      
      const tokens = await this.marketPlaceRouter.getAllTokens();
      expect(tokens[0].forAuction).to.equal(false);
      expect(tokens[0].price).to.equal(bigNum('5'));

      const details = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, this.tokenID);
      expect(smallNum(details.price)).to.equal(5);
   })

   it ('get action history', async function () {
      const history = await this.marketPlaceRouter.getAuctionHistory(this.nft1.address, this.tokenID);
      expect(history.length).to.equal(2);
   })

   it ('get all tokens without error', async function () {
      const allTokens = await this.marketPlaceRouter.getAllTokens();
      const tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.nft1.address, 0);
   })

   it ('list auction and cancel it', async function () {
      const tokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      const tokenID = tokens[0].tokenID;
      await this.nft1.connect(this.minter1).approve(this.marketPlace.address, tokenID);
      await this.marketPlaceRouter.connect(this.minter1).listAuction(
         this.nft1.address,
         [tokenID],
         AUCTION_TYPE_NORMAL,
         bigNum(1),
         0
      );

      const auctions = await this.marketPlaceRouter.getAuctionListByOwner(this.minter1.address);
      const auctionID = auctions[0].auctionID;

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(4));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         auctionID,
         bigNum(4)
      );

      await this.WETH.connect(this.bider2).approve(this.marketPlace.address, bigNum(6));
      await this.marketPlaceRouter.connect(this.bider2).bidAuction(
         auctionID,
         bigNum(6)
      );

      await this.marketPlaceRouter.cancelAuction(auctionID);

      expect((await this.marketPlaceRouter.getAuctionList()).length).to.equal(0);

   })
})