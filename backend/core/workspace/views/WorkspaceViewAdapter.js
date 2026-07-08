import { deepFreeze } from "../_utils/deepFreeze.js";

import { buildDashboardView } from "./DashboardViewBuilder.js";
import { buildNavigationView } from "./NavigationViewBuilder.js";
import { buildModulesView } from "./ModuleViewBuilder.js";
import { buildRecommendationsView } from "./RecommendationViewBuilder.js";
import { buildQueueView } from "./QueueViewBuilder.js";
import { buildDigitalWorkforceView } from "./DigitalWorkforceViewBuilder.js";
import { buildKnowledgeView } from "./KnowledgeViewBuilder.js";
import { buildAnalyticsView } from "./AnalyticsViewBuilder.js";
import { buildCompanyHealthView } from "./CompanyHealthViewBuilder.js";
import { buildMorningBriefView } from "./MorningBriefViewBuilder.js";
import { buildNotificationsView } from "./NotificationsViewBuilder.js";
import { validateWorkspaceViews } from "./WorkspaceViewValidator.js";

export class WorkspaceViewAdapter {
  constructor({ runtime } = {}) {
    this.runtime = runtime;
  }

  // Entry point: returns all page-ready view models.
  translate(workspaceConfig) {
    validateWorkspaceViews(workspaceConfig, {});

    const views = deepFreeze({
      dashboard: buildDashboardView({ workspaceConfig, runtime: this.runtime }),
      navigation: buildNavigationView({ workspaceConfig }),
      modules: buildModulesView({ workspaceConfig }),
      recommendations: buildRecommendationsView({ workspaceConfig }),
      queues: buildQueueView({ workspaceConfig, runtime: this.runtime }),
      digitalWorkforce: buildDigitalWorkforceView({ workspaceConfig, runtime: this.runtime }),
      knowledge: buildKnowledgeView({ workspaceConfig, runtime: this.runtime }),
      analytics: buildAnalyticsView({ workspaceConfig }),
      companyHealth: buildCompanyHealthView({ workspaceConfig }),
      morningBrief: buildMorningBriefView({ workspaceConfig }),
      notifications: buildNotificationsView({ workspaceConfig }),
    });

    return views;
  }

  getDashboardView(workspaceConfig) {
    return buildDashboardView({ workspaceConfig, runtime: this.runtime });
  }

  getNavigationView(workspaceConfig) {
    return buildNavigationView({ workspaceConfig });
  }

  getModulesView(workspaceConfig) {
    return buildModulesView({ workspaceConfig });
  }

  getRecommendationsView(workspaceConfig) {
    return buildRecommendationsView({ workspaceConfig });
  }

  getWorkQueueView(workspaceConfig) {
    return buildQueueView({ workspaceConfig, runtime: this.runtime });
  }

  getDigitalWorkforceView(workspaceConfig) {
    return buildDigitalWorkforceView({ workspaceConfig, runtime: this.runtime });
  }

  getKnowledgeView(workspaceConfig) {
    return buildKnowledgeView({ workspaceConfig, runtime: this.runtime });
  }
}

