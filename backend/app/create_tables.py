from app.core.database import Base, engine
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.invoice_file import InvoiceFile
from app.models.users import User

Base.metadata.create_all(bind=engine)


print("Database tables are ready.")
