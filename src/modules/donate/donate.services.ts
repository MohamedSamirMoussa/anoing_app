import { NextFunction, Request, Response } from "express";
import {
  // createPayment,
  getAccessToken,
  NotFoundError,
  successHandler,
} from "../../utils";
// import { Types } from "mongoose";
import {
  DonateEnum,
  DonateModel,
  DonateRepository,
  LeaderboardModel,
  LeaderboardRepository,
  StatusEnum,
} from "../../DB";
import axios from "axios";

class DonateServices {
  private donateModel = new DonateRepository(DonateModel);
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);

  constructor() {}

  // createPaymentIntent = async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction,
  // ): Promise<Response | void> => {
  //   try {
  //     const userId = req.params as unknown as Types.ObjectId;
  //     const { amount } = req.body;
  //     const { success_url, url } = await createPayment(amount, userId);

  //     return successHandler({
  //       res,
  //       result: { success_url, url },
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // };

  createPaypalOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { amount, username } = req.body;
      if (!amount?.value || !username) {
        throw new NotFoundError("All fields are required");
      }
      const accessToken = await getAccessToken();

      const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: username,
              amount: {
                currency_code: amount.currency_code,
                value: amount.value,
              },
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const orderId = response.data.id;

      return successHandler({ res, result: orderId });
    } catch (error: any) {
      console.log(error);

      next(error);
    }
  };

  capturePaymentWithPaypal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const accessToken = await getAccessToken();
      const { orderId } = req.params;

      const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const paymentData = response.data;
      const mcUsername =
        paymentData.purchase_units[0].payments.captures[0].custom_id;
      await this.donateModel.create({
        data: [
          {
            payerMCusername: mcUsername,
            payerUsername: paymentData.payer?.name,
            donateId: paymentData.id,
            payerId: paymentData?.payer?.payer_id,
            provider: DonateEnum.paypal,
            status: paymentData.status as StatusEnum,
          },
        ],
        options: { validateBeforeSave: true },
      });

      if (paymentData.status === "COMPLETED") {
        await this.leaderboardModel.findOneAndUpdate({
          filter: { username: mcUsername },
          update: { $set: { isSupported: { name: "Supporter" } } },
        });
      }

      return successHandler({
        res,
        message: "Payment Captured Successfully",
        result: paymentData,
      });
    } catch (error: any) {
      next(error);
    }
  };
}

export default new DonateServices();
