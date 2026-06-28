/**
 * Discord notification service for Knowledge DB
 * Sends crawler completion and error notifications
 */

class DiscordService {
  constructor() {
    this.errorWebhook = process.env.DISCORD_WEBHOOK_ERRORS;
    this.completionWebhook = process.env.DISCORD_WEBHOOK_COMPLETION;
  }

  /**
   * Send crawler completion notification
   * @param {Object} data - Completion data
   * @param {string} data.crawler - Crawler name (arxiv, devto, etc.)
   * @param {number} data.count - Number of items crawled
   * @param {number} data.duration - Duration in milliseconds
   * @param {string} [data.status] - 'success', 'warning', 'error'
   */
  async sendCrawlerCompletion(data) {
    if (!this.completionWebhook) {
      console.warn("[Discord] Completion webhook not configured");
      return false;
    }

    try {
      const { crawler, count, duration, status = "success" } = data;
      const color = this.getStatusColor(status);
      const durationSecs = (duration / 1000).toFixed(2);

      const embed = {
        title: `Crawler Complete: ${crawler}`,
        description: `Successfully crawled **${count}** items in **${durationSecs}s**`,
        color,
        fields: [
          {
            name: "Crawler",
            value: crawler,
            inline: true,
          },
          {
            name: "Items",
            value: count.toString(),
            inline: true,
          },
          {
            name: "Duration",
            value: `${durationSecs}s`,
            inline: true,
          },
          {
            name: "Status",
            value: status.toUpperCase(),
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      return await this.sendWebhook(this.completionWebhook, {
        embeds: [embed],
      });
    } catch (error) {
      console.error("[Discord] Error sending completion:", error.message);
      return false;
    }
  }

  /**
   * Send error notification
   * @param {Object} data - Error data
   * @param {string} data.title - Error title
   * @param {string} data.message - Error message
   * @param {string} [data.source] - Source (crawler name, etc.)
   * @param {string} [data.stack] - Stack trace
   * @param {string} [data.severity] - 'low', 'medium', 'high', 'critical'
   */
  async sendError(data) {
    if (!this.errorWebhook) {
      console.warn("[Discord] Error webhook not configured");
      return false;
    }

    try {
      const { title, message, source, stack, severity = "high" } = data;
      const color = this.getSeverityColor(severity);

      const fields = [
        {
          name: "Message",
          value: message,
          inline: false,
        },
      ];

      if (source) {
        fields.push({
          name: "Source",
          value: source,
          inline: true,
        });
      }

      if (severity) {
        fields.push({
          name: "Severity",
          value: severity.toUpperCase(),
          inline: true,
        });
      }

      if (stack) {
        const stackPreview = stack.split("\n").slice(0, 3).join("\n");
        fields.push({
          name: "Stack Trace",
          value: `\`\`\`${stackPreview}\`\`\``,
          inline: false,
        });
      }

      const embed = {
        title,
        color,
        fields,
        timestamp: new Date().toISOString(),
      };

      return await this.sendWebhook(this.errorWebhook, { embeds: [embed] });
    } catch (error) {
      console.error("[Discord] Error sending notification:", error.message);
      return false;
    }
  }

  /**
   * Send webhook payload
   * @private
   */
  async sendWebhook(webhookUrl, payload) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 204) {
        return true;
      } else {
        console.error(`[Discord] Failed (HTTP ${response.status})`);
        return false;
      }
    } catch (error) {
      console.error("[Discord] Fetch error:", error.message);
      return false;
    }
  }

  /**
   * Get color code based on severity
   * @private
   */
  getSeverityColor(severity) {
    const colors = {
      critical: 15158332, // Red
      high: 16776960, // Yellow
      medium: 16776960, // Yellow
      low: 3447003, // Blue
    };
    return colors[severity] || 3447003;
  }

  /**
   * Get color code based on status
   * @private
   */
  getStatusColor(status) {
    const colors = {
      success: 65280, // Green
      warning: 16776960, // Yellow
      error: 15158332, // Red
    };
    return colors[status] || 3447003;
  }
}

export default new DiscordService();
