"""Schedule module manifest."""

from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_schedule",
    version="0.1.0",
    display_name="Schedule",
    description="Construction scheduling — activities, milestones, and timeline management",
    author="OpenEstimate Core Team",
    category="core",
    depends=["oe_projects"],
    auto_install=True,
    enabled=True,
)
