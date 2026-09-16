import {
  applyUrlScanResult,
  parseUrlScanResultMessage,
} from "../src/lib/submissions/url-scan-jobs";

export async function consumeUrlScanResults(
  batch: MessageBatch<unknown>,
  db: D1Database,
): Promise<void> {
  for (const queueMessage of batch.messages) {
    const message = parseUrlScanResultMessage(queueMessage.body);
    if (!message) {
      console.error(
        JSON.stringify({ event: "url_scan_result_rejected", queue_message_id: queueMessage.id }),
      );
      queueMessage.ack();
      continue;
    }

    try {
      await applyUrlScanResult(db, message);
      queueMessage.ack();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "url_scan_result_failed",
          job_id: message.job_id,
          message: error instanceof Error ? error.message : "unknown_error",
        }),
      );
      queueMessage.retry({ delaySeconds: 30 });
    }
  }
}
