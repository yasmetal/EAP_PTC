-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "trackingCheckedAt" TIMESTAMP(3),
ADD COLUMN     "trackingError" TEXT,
ADD COLUMN     "trackingHookedAt" TIMESTAMP(3),
ADD COLUMN     "trackingLocation" TEXT,
ADD COLUMN     "trackingStatusCode" TEXT,
ADD COLUMN     "trackingStatusText" TEXT,
ADD COLUMN     "trackingUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL,
    "statusText" TEXT NOT NULL,
    "location" TEXT,
    "postcode" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceToken" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentId_eventAt_idx" ON "TrackingEvent"("shipmentId", "eventAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_barcode_idx" ON "TrackingEvent"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEvent_shipmentId_statusCode_eventAt_key" ON "TrackingEvent"("shipmentId", "statusCode", "eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceToken_service_key" ON "ServiceToken"("service");

-- CreateIndex
CREATE INDEX "Shipment_trackingNo_idx" ON "Shipment"("trackingNo");

-- CreateIndex
CREATE INDEX "Shipment_status_trackingCheckedAt_idx" ON "Shipment"("status", "trackingCheckedAt");

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
