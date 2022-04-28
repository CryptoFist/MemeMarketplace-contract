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

describe('MarketPlace: Check Each process', function () {
   beforeEach (async function () {
      [
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
         this.fundAddress,
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

      for (let i = 0; i < 5; i ++) {
         await this.marketPlaceRouter.mintNFT('test tokenURI', {value: ethers.utils.parseEther('0.001')});
         await this.marketPlaceRouter.connect(this.minter2).mintNFT('test tokenURI', {value: ethers.utils.parseEther('0.001')});
         await this.marketPlaceRouter.connect(this.bider1).mintNFT('test tokenURI', {value: ethers.utils.parseEther('0.001')});
         await this.marketPlaceRouter.connect(this.bider2).mintNFT('test tokenURI', {value: ethers.utils.parseEther('0.001')});
      }
   })

   it ('check price history and withDraw', async function () {
      await this.revNFT.setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.listNFTForSale(this.revNFT.address, [0], bigNum(8));

      let saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(1);
      let saleID = saleList[0].sellID;
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(
         saleID,
         {value: bigNum(8)}
      );

      let priceHistory = await this.marketPlaceRouter.getPriceHistory(this.revNFT.address, 0);
      expect(priceHistory.length).to.equal(1);
      expect(smallNum(priceHistory[0].price)).to.equal(8);

      await this.revNFT.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider1).listNFTForSale(this.revNFT.address, [0], bigNum(4));

      saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(1);
      saleID = saleList[0].sellID;
      await this.marketPlaceRouter.closeSale(saleID);

      saleList = await this.marketPlaceRouter.getTokensForSale();
      expect(saleList.length).to.equal(0);

      priceHistory = await this.marketPlaceRouter.getPriceHistory(this.revNFT.address, 0);
      expect(priceHistory.length).to.equal(1);
      expect(smallNum(priceHistory[0].price)).to.equal(8);

      await this.revNFT.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider1).listAuction(
         this.revNFT.address,
         [0],
         AUCTION_TYPE_SALE,
         bigNum(4),
         0
      );

      let auctions = await this.marketPlaceRouter.connect(this.bider1).getAuctionList();
      expect(auctions.length).to.equal(1);
      let auctionID = auctions[0].auctionID;
      await this.WETH.approve(this.marketPlace.address, bigNum(10000));
      await this.marketPlaceRouter.bidAuction(auctionID, bigNum(4));

      priceHistory = await this.marketPlaceRouter.getPriceHistory(this.revNFT.address, 0);
      expect(priceHistory.length).to.equal(2);
      expect(smallNum(priceHistory[1].price)).to.equal(4);

      // check withDraw function
      await this.marketPlaceRouter.pause();
      await this.marketPlaceRouter.setFundAddress(this.fundAddress.address);
      let ETHAmount = smallNum(await ethers.provider.getBalance(this.fundAddress.address));
      let WETHAmount = smallNum(await this.WETH.balanceOf(this.fundAddress.address));

      await this.marketPlaceRouter.withDraw();
      ETHAmount = smallNum(await ethers.provider.getBalance(this.fundAddress.address))- ETHAmount;
      WETHAmount = smallNum(await this.WETH.balanceOf(this.fundAddress.address)) - WETHAmount;

      expect(ETHAmount).to.greaterThan(0);
      expect(WETHAmount).to.greaterThan(0);
   })

   it ('check reserve sale and auction', async function () {
      // list 3 normal sale and 1 reserve sale and check.
      for (let i = 0; i < 3; i ++) {
         await this.revNFT.setApprovalForAll(this.marketPlace.address, true);
         await this.marketPlaceRouter.listNFTForSale(
            this.revNFT.address,
            [i * 4],
            bigNum(i + 1)
         );
      }

      await this.revNFT.setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.listNFTForReserveSale(
         this.revNFT.address,
         this.bider1.address,
         [12],
         bigNum(4)
      );

      let saleTokens = await this.marketPlaceRouter.connect(this.minter2).getTokensForSale();
      expect(saleTokens.length).to.equal(3);

      saleTokens = await this.marketPlaceRouter.connect(this.bider1).getTokensForSale();
      expect(saleTokens.length).to.equal(4);
      const saleID = saleTokens[3].sellID;

      await expect(
         this.marketPlaceRouter.connect(this.minter2).buyNFTs(saleID, {value: bigNum(4)})
      ).to.be.revertedWith('sale: not allowed');

      let balance = await this.revNFT.balanceOf(this.bider1.address);
      await this.marketPlaceRouter.connect(this.bider1).buyNFTs(saleID, {value: bigNum(4)});
      balance = await this.revNFT.balanceOf(this.bider1.address) - balance;
      expect(balance).to.equal(1);

      // list 3 normal auction and 1 reserve auction and check
      for (let i = 0; i < 3; i ++) {
         await this.revNFT.connect(this.minter2).setApprovalForAll(this.marketPlace.address, true);
         await this.marketPlaceRouter.connect(this.minter2).listAuction(
            this.revNFT.address,
            [i * 4 + 1],
            AUCTION_TYPE_NORMAL,
            bigNum(i + 1),
            10
         );
      }

      await this.revNFT.connect(this.minter2).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.minter2).listAuctionForReserve(
         this.revNFT.address,
         this.bider1.address,
         [13],
         AUCTION_TYPE_NORMAL,
         bigNum(4),
         10
      );

      let auctionTokens = await this.marketPlaceRouter.connect(this.minter1).getAuctionList();
      expect(auctionTokens.length).to.equal(3);
      auctionTokens = await this.marketPlaceRouter.connect(this.bider1).getAuctionList();
      expect(auctionTokens.length).to.equal(4);
      let auctionID = auctionTokens[3].auctionID;

      await expect(
         this.marketPlaceRouter.connect(this.minter1).bidAuction(
            auctionID,
            bigNum(4)
         )
      ).to.be.revertedWith('not allowed');

      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         auctionID,
         bigNum(6)
      );

      let bidders = await this.marketPlaceRouter.getBidderInfo(auctionID);
      expect(bidders.length).to.equal(1);
      expect(bidders[0].askPerson).to.equal(this.bider1.address);
      expect(bidders[0].askPrice).to.equal(bigNum(6));

      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         auctionID,
         bigNum(8)
      );

      bidders = await this.marketPlaceRouter.getBidderInfo(auctionID);
      expect(bidders.length).to.equal(1);
      expect(bidders[0].askPerson).to.equal(this.bider1.address);
      expect(bidders[0].askPrice).to.equal(bigNum(8));
   })

   it ('check remove NFT from marketplace', async function () {
      let ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      expect(ownedTokens.length).to.equal(5);
      
      // remove NFT twice and check
      await this.marketPlaceRouter.removeNFT(this.revNFT.address, [16]);
      ownedTokens = await this.marketPlaceRouter.getTokensByOwner(this.minter1.address);
      expect(ownedTokens.length).to.equal(4);
      expect(ownedTokens[3].tokenID).to.equal(12);

      await expect(
         this.marketPlaceRouter.removeNFT(this.revNFT.address, [16])
      ).to.be.revertedWith('not owner');
   })

   it ('check make offer and cancel offer', async function () {
      await this.revNFT.connect(this.minter2).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.minter2).makeOffer(
         [
            {
               tokenAddress: this.revNFT.address,
               tokenID: 0
            }
         ],
         bigNum(0),
         bigNum(7)
      );

      await this.revNFT.connect(this.bider1).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider1).makeOffer(
         [
            {
               tokenAddress: this.revNFT.address,
               tokenID: 0
            },
            {
               tokenAddress: this.revNFT.address,
               tokenID: 2
            }
         ],
         bigNum(1),
         bigNum(5)
      );

      await this.revNFT.connect(this.bider2).setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.connect(this.bider2).makeOffer(
         [
            {
               tokenAddress: this.revNFT.address,
               tokenID: 0
            },
            {
               tokenAddress: this.revNFT.address,
               tokenID: 3
            }
         ],
         bigNum(2),
         bigNum(4)
      );

      let offers = await this.marketPlaceRouter.getOffers(this.revNFT.address, 0);
      expect(offers.length).to.equal(3);

      await expect(
         this.marketPlaceRouter.cancelOffer(
            this.revNFT.address,
            0
         )
      ).to.be.revertedWith('not exist offer');

      await this.marketPlaceRouter.connect(this.bider2).cancelOffer(
         this.revNFT.address,
         0
      );

      offers = await this.marketPlaceRouter.getOffers(this.revNFT.address, 0);
      expect(offers.length).to.equal(2);

      let tokenDetail = await this.marketPlaceRouter.getTokenDetail(this.revNFT.address, 0);
      expect(tokenDetail.offerCount).to.equal(2);
   }) 

   it ('check cancel auction', async function () {
      await this.revNFT.setApprovalForAll(this.marketPlace.address, true);
      await this.marketPlaceRouter.listAuction(
         this.revNFT.address,
         [0],
         AUCTION_TYPE_NORMAL,
         bigNum(4),
         10
      );

      let auctionList = await this.marketPlaceRouter.getAuctionList();
      let auctionID = auctionList[0].auctionID;

      await this.WETH.connect(this.minter2).approve(this.marketPlace.address, bigNum(1000));
      await this.marketPlaceRouter.connect(this.minter2).bidAuction(
         auctionID,
         bigNum(6)
      );

      await this.WETH.connect(this.bider1).approve(this.marketPlace.address, bigNum(1000));
      await this.marketPlaceRouter.connect(this.bider1).bidAuction(
         auctionID,
         bigNum(8)
      );

      let bidders = await this.marketPlaceRouter.getBidderInfo(auctionID);
      expect(bidders.length).to.equal(2);

      await this.marketPlaceRouter.connect(this.bider1).cancelBidAuction(auctionID);
      bidders = await this.marketPlaceRouter.getBidderInfo(auctionID);
      expect(bidders.length).to.equal(1);
   })
})