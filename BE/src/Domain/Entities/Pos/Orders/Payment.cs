using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>Thanh toán của hóa đơn, một hóa đơn một thanh toán (bảng <c>Pos_Payments</c>, BR-08).</summary>
public class Payment : BaseEntity
{
    public const int QrContentMaxLength = 300;

    private Payment()
    {
    }

    internal Payment(Guid orderId, PaymentMethod method, decimal amount, decimal? cashReceived, string? qrContent, DateTime paidAtUtc)
    {
        OrderId = orderId;
        Method = method;
        Amount = amount;
        PaidAt = paidAtUtc;
        if (method == PaymentMethod.TienMat)
        {
            if (cashReceived is null || cashReceived < amount)
                throw new DomainException($"Còn thiếu {PosRules.FormatVnd(amount - (cashReceived ?? 0))}");

            CashReceived = cashReceived;
            ChangeAmount = cashReceived - amount;
        }
        else
        {
            QrContent = string.IsNullOrWhiteSpace(qrContent) ? null : qrContent.Trim();
        }
    }

    public Guid OrderId { get; private set; }
    public PaymentMethod Method { get; private set; }
    public decimal Amount { get; private set; }
    public decimal? CashReceived { get; private set; }
    public decimal? ChangeAmount { get; private set; }
    public string? QrContent { get; private set; }
    public DateTime PaidAt { get; private set; }
}
