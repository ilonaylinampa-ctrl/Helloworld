"""
Forestry Asset Management Application
Manages assets of forestry tools and machines.
"""

from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from datetime import date
import os

db = SQLAlchemy()

# ── Constants ─────────────────────────────────────────────────────────────────

ASSET_CATEGORIES = ["tool", "machine"]
ASSET_STATUSES = ["available", "in_use", "maintenance", "retired"]


# ── Models ────────────────────────────────────────────────────────────────────

class Asset(db.Model):
    """Represents a forestry tool or machine."""

    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(20), nullable=False)    # tool | machine
    asset_type = db.Column(db.String(80), nullable=False)  # e.g. chainsaw, harvester
    serial_number = db.Column(db.String(60), unique=True, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="available")
    location = db.Column(db.String(120), nullable=True)
    purchase_date = db.Column(db.Date, nullable=True)
    last_maintenance = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "asset_type": self.asset_type,
            "serial_number": self.serial_number,
            "status": self.status,
            "location": self.location,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "last_maintenance": self.last_maintenance.isoformat() if self.last_maintenance else None,
            "notes": self.notes,
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def validate_asset_payload(data, require_all=True):
    """Return (asset_dict, error_message)."""
    errors = []

    name = data.get("name", "").strip()
    category = data.get("category", "").strip().lower()
    asset_type = data.get("asset_type", "").strip()
    status = data.get("status", "available").strip().lower()

    if require_all:
        if not name:
            errors.append("'name' is required.")
        if category not in ASSET_CATEGORIES:
            errors.append(f"'category' must be one of {ASSET_CATEGORIES}.")
        if not asset_type:
            errors.append("'asset_type' is required.")

    if status and status not in ASSET_STATUSES:
        errors.append(f"'status' must be one of {ASSET_STATUSES}.")

    if errors:
        return None, "; ".join(errors)

    return {
        "name": name,
        "category": category,
        "asset_type": asset_type,
        "serial_number": data.get("serial_number") or None,
        "status": status,
        "location": data.get("location") or None,
        "purchase_date": parse_date(data.get("purchase_date")),
        "last_maintenance": parse_date(data.get("last_maintenance")),
        "notes": data.get("notes") or None,
    }, None


# ── Seed Data ─────────────────────────────────────────────────────────────────

def seed_data():
    """Populate the database with sample forestry assets."""
    if Asset.query.count() > 0:
        return

    samples = [
        Asset(name="Husqvarna 572 XP Chainsaw", category="tool", asset_type="chainsaw",
              serial_number="HQ572-001", status="available", location="Warehouse A",
              purchase_date=date(2022, 3, 15), notes="Heavy-duty chainsaw for felling"),
        Asset(name="Stihl MS 400 Chainsaw", category="tool", asset_type="chainsaw",
              serial_number="ST400-002", status="in_use", location="Section B",
              purchase_date=date(2021, 7, 20)),
        Asset(name="Fiskars X27 Splitting Axe", category="tool", asset_type="axe",
              serial_number="FX27-003", status="available", location="Warehouse A",
              purchase_date=date(2023, 1, 10)),
        Asset(name="John Deere 1270G Harvester", category="machine", asset_type="harvester",
              serial_number="JD1270-001", status="available", location="Depot 1",
              purchase_date=date(2020, 6, 1), last_maintenance=date(2025, 11, 5),
              notes="Full-tree harvester, annual service completed"),
        Asset(name="Ponsse Scorpion King Forwarder", category="machine", asset_type="forwarder",
              serial_number="PS-001", status="in_use", location="Section C",
              purchase_date=date(2019, 9, 14), last_maintenance=date(2025, 8, 20)),
        Asset(name="Komatsu 931XC Harvester", category="machine", asset_type="harvester",
              serial_number="KM931-001", status="maintenance", location="Service Centre",
              purchase_date=date(2018, 4, 22), last_maintenance=date(2026, 1, 15),
              notes="Undergoing scheduled 1000h service"),
        Asset(name="Husqvarna 550 XP Mark II Chainsaw", category="tool", asset_type="chainsaw",
              serial_number="HQ550-007", status="maintenance", location="Workshop",
              purchase_date=date(2020, 11, 3), notes="Chain sharpening required"),
        Asset(name="Tigercat 1085B Forwarder", category="machine", asset_type="forwarder",
              serial_number="TC1085-001", status="retired", location="Depot 2",
              purchase_date=date(2015, 2, 28), notes="Decommissioned – parts salvaged"),
    ]
    db.session.add_all(samples)
    db.session.commit()


# ── Application Factory ───────────────────────────────────────────────────────

def create_app(config=None):
    """Create and configure the Flask application."""
    application = Flask(__name__)
    application.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///forestry_assets.db"
    )
    application.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if config:
        application.config.update(config)

    db.init_app(application)

    with application.app_context():
        db.create_all()
        if not application.config.get("TESTING"):
            seed_data()

    # ── Frontend ──────────────────────────────────────────────────────────────

    @application.route("/")
    def index():
        return render_template("index.html")

    # ── API ───────────────────────────────────────────────────────────────────

    @application.route("/api/assets", methods=["GET"])
    def list_assets():
        """List assets, optionally filtered by category or status."""
        query = Asset.query
        category = request.args.get("category")
        status = request.args.get("status")
        if category:
            query = query.filter_by(category=category.lower())
        if status:
            query = query.filter_by(status=status.lower())
        assets = query.order_by(Asset.id).all()
        return jsonify([a.to_dict() for a in assets])

    @application.route("/api/assets/<int:asset_id>", methods=["GET"])
    def get_asset(asset_id):
        asset = db.get_or_404(Asset, asset_id)
        return jsonify(asset.to_dict())

    @application.route("/api/assets", methods=["POST"])
    def create_asset():
        data = request.get_json(silent=True) or {}
        payload, error = validate_asset_payload(data, require_all=True)
        if error:
            return jsonify({"error": error}), 400

        if payload["serial_number"]:
            existing = Asset.query.filter_by(serial_number=payload["serial_number"]).first()
            if existing:
                return jsonify({"error": "serial_number already exists."}), 409

        asset = Asset(**payload)
        db.session.add(asset)
        db.session.commit()
        return jsonify(asset.to_dict()), 201

    @application.route("/api/assets/<int:asset_id>", methods=["PUT"])
    def update_asset(asset_id):
        asset = db.get_or_404(Asset, asset_id)
        data = request.get_json(silent=True) or {}
        payload, error = validate_asset_payload(data, require_all=False)
        if error:
            return jsonify({"error": error}), 400

        new_sn = payload.get("serial_number")
        if new_sn and new_sn != asset.serial_number:
            existing = Asset.query.filter_by(serial_number=new_sn).first()
            if existing:
                return jsonify({"error": "serial_number already exists."}), 409

        for key, value in payload.items():
            if value is not None or key in ("serial_number", "location", "notes"):
                setattr(asset, key, value)
        db.session.commit()
        return jsonify(asset.to_dict())

    @application.route("/api/assets/<int:asset_id>", methods=["DELETE"])
    def delete_asset(asset_id):
        asset = db.get_or_404(Asset, asset_id)
        db.session.delete(asset)
        db.session.commit()
        return jsonify({"message": f"Asset {asset_id} deleted."}), 200

    @application.route("/api/assets/<int:asset_id>/status", methods=["PATCH"])
    def update_status(asset_id):
        asset = db.get_or_404(Asset, asset_id)
        data = request.get_json(silent=True) or {}
        status = (data.get("status") or "").strip().lower()
        if status not in ASSET_STATUSES:
            return jsonify({"error": f"'status' must be one of {ASSET_STATUSES}."}), 400
        asset.status = status
        db.session.commit()
        return jsonify(asset.to_dict())

    @application.route("/api/stats", methods=["GET"])
    def stats():
        """Return summary statistics for the dashboard."""
        total = Asset.query.count()
        by_category = {c: Asset.query.filter_by(category=c).count() for c in ASSET_CATEGORIES}
        by_status = {s: Asset.query.filter_by(status=s).count() for s in ASSET_STATUSES}
        return jsonify({"total": total, "by_category": by_category, "by_status": by_status})

    return application


# ── Entry Point ───────────────────────────────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, port=5000)
