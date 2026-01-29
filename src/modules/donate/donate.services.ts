import { NextFunction, Request, Response } from "express";
import {
  createPayment,
  getAccessToken,
  NotFoundError,
  successHandler,
} from "../../utils";
import { Types } from "mongoose";
import {
  DonateEnum,
  DonateModel,
  DonateRepository,
  StatusEnum,
} from "../../DB";
import axios from "axios";

class DonateServices {
  private donateModel = new DonateRepository(DonateModel);

  constructor() {}

  createPaymentIntent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const userId = req.params as unknown as Types.ObjectId;
      const { amount } = req.body;
      const { success_url, url } = await createPayment(amount, userId);

      return successHandler({
        res,
        result: { success_url, url },
      });
    } catch (error) {
      next(error);
    }
  };

  createPaypalOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { amount } = req.body;

      if (!amount) throw new NotFoundError("amount not found");

      const accessToken = await getAccessToken();

      console.log(process.env.PAYPAL_BASE_URL);

      const response = await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              amount,
              description: "Test Purchase",
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

      console.log("RES::::::", response);

      // ✅ في axios الرد يكون في response.data
      const orderId = response.data.id;

      return successHandler({ res, result: orderId });
    } catch (error: any) {
      console.error(
        "Create Order Error:",
        error.response?.data || error.message,
      );
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
        {}, // الـ body يكون فارغ في الـ capture
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const paymentData = response.data;

      await this.donateModel.create({
        data: [
          {
            payerUsername: paymentData.payer?.name,
            donateId: paymentData.id,
            payerId: paymentData?.payer?.payer_id,
            provider: DonateEnum.paypal,
            status: paymentData.status as StatusEnum,
          },
        ],
        options: { validateBeforeSave: true },
      });

      return successHandler({
        res,
        message: "Payment Captured Successfully",
        result: paymentData,
      });
    } catch (error: any) {
      console.error("Capture Error:", error.response?.data || error.message);
      next(error);
    }
  };
}

export default new DonateServices();
