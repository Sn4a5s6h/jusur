const PDFDocument =
    require("pdfkit");

const fs =
    require("fs");

const path =
    require("path");


function generateInvoicePDF(
    invoice,
    items,
    outputDirectory = "invoices"
) {

    fs.mkdirSync(
        outputDirectory,
        {
            recursive: true
        }
    );


    const filePath =
        path.join(
            outputDirectory,
            `${invoice.inv_no}.pdf`
        );


    return new Promise(
        (resolve, reject) => {

            const doc =
                new PDFDocument({

                    size: [226, 520],

                    margin: 10

                });


            const stream =
                fs.createWriteStream(
                    filePath
                );


            stream.on(
                "finish",
                () => resolve(filePath)
            );


            stream.on(
                "error",
                reject
            );


            doc.pipe(stream);


            doc.fontSize(15)
                .text(
                    "JUSOOR",
                    {
                        align: "center"
                    }
                );


            doc.fontSize(10)
                .text(
                    "فاتورة مبيعات",
                    {
                        align: "center"
                    }
                );


            doc.moveDown();


            doc.fontSize(8)
                .text(
                    `رقم الفاتورة: ${invoice.inv_no}`
                );


            doc.text(
                `العميل: ${invoice.customer_name}`
            );


            doc.text(
                `نوع البيع: ${
                    invoice.type === "credit"
                        ? "آجل"
                        : "نقدي"
                }`
            );


            if (invoice.due_date) {

                doc.text(
                    `الاستحقاق: ${invoice.due_date}`
                );

            }


            doc.moveDown();


            for (const item of items) {

                doc.text(

                    `${item.name}`

                );

                doc.text(

                    `${item.qty} ${item.unit} × ${item.price} = ${item.qty * item.price} ريال`

                );

                doc.moveDown(0.2);

            }


            doc.moveDown();


            doc.text(
                "----------------------------"
            );


            doc.fontSize(11)
                .text(
                    `الإجمالي: ${invoice.total} ريال`
                );


            doc.fontSize(8)
                .text(
                    `المدفوع: ${invoice.paid} ريال`
                );


            doc.text(
                `المتبقي: ${
                    invoice.total -
                    invoice.paid
                } ريال`
            );


            doc.moveDown();


            doc.text(
                "شكراً لتعاملكم مع جسور",
                {
                    align: "center"
                }
            );


            doc.end();

        }
    );

}


module.exports = {

    generateInvoicePDF

};
