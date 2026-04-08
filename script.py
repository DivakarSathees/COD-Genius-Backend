import sys
from datetime import datetime, timedelta
class Book:
    def __init__(self, BookID, BorrowDate, ReturnDate):
        self.BookID = BookID
        self.BorrowDate = datetime.strptime(BorrowDate, '%Y-%m-%d')
        self.ReturnDate = datetime.strptime(ReturnDate, '%Y-%m-%d')
    def IsOverdue(self):
        return (self.ReturnDate - self.BorrowDate).days > 14
    def CalculateFine(self):
        if self.IsOverdue():
            return (self.ReturnDate - self.BorrowDate).days * 0.5
        else:
            return 0.0
def main():
    try:
        num_books = int(sys.stdin.readline().strip())
        for _ in range(num_books):
            BookID, BorrowDate, ReturnDate = sys.stdin.readline().strip().split()
            book = Book(BookID, BorrowDate, ReturnDate)
            fine = book.CalculateFine()
            overdue = book.IsOverdue()
            print(f"BookID: {book.BookID}, BorrowDate: {book.BorrowDate.strftime('%Y-%m-%d')}, ReturnDate: {book.ReturnDate.strftime('%Y-%m-%d')}, IsOverdue: {overdue}, Fine: {fine}")
    except Exception as e:
        pass
if __name__ == '__main__':
    main()