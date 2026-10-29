<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  exclude-result-prefixes="n1 cbc cac ext">
  <xsl:output method="html" encoding="UTF-8" indent="no"/>
  <xsl:decimal-format name="tr" decimal-separator="," grouping-separator="."/>
  <xsl:variable name="watermark" select="'e-Fatura'"/>
  <xsl:template name="money">
    <xsl:param name="v"/>
    <xsl:param name="cur" select="''"/>
    <xsl:if test="string(number($v)) != 'NaN'">
      <xsl:value-of select="format-number($v, '#.##0,00', 'tr')"/>
      <xsl:choose>
        <xsl:when test="string($cur) = ''"/>
        <xsl:when test="$cur = 'TRY'"><xsl:text> TL</xsl:text></xsl:when>
        <xsl:otherwise><xsl:text> </xsl:text><xsl:value-of select="$cur"/></xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>
  <xsl:template name="date-tr">
    <xsl:param name="d"/>
    <xsl:if test="string-length($d) >= 10">
      <xsl:value-of select="concat(substring($d, 9, 2), '-', substring($d, 6, 2), '-', substring($d, 1, 4))"/>
    </xsl:if>
  </xsl:template>
  <xsl:template name="number-tr">
    <xsl:param name="v"/>
    <xsl:if test="string(number($v)) != 'NaN'">
      <xsl:value-of select="format-number($v, '#.##0,##', 'tr')"/>
    </xsl:if>
  </xsl:template>
  <xsl:template match="/">
    <html>
      <head>
        <meta charset="UTF-8"/>
        <title>e-Fatura USD</title>
        <style>
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 10mm; }
          body { font-family: 'Arial', sans-serif; font-size: 9pt; color: #000000; margin: 0; }
          table { border-collapse: collapse; }
          thead { display: table-header-group; }
          .cols { width: 100%; table-layout: fixed; }
          .cols td { vertical-align: top; padding: 1mm; }
          .sec { margin-bottom: 3mm; }
          .blk { margin: 0.5mm 0; }
          .blk-text { white-space: pre-line; }
          .lbl { font-weight: bold; }
          .lines, .taxes { width: 100%; }
          .lines th, .lines td, .taxes th, .taxes td { border: 1px solid #1f3a5f; padding: 1mm; }
          .lines th, .taxes th { background: #1f3a5f; color: #ffffff; }
          .lines tr, .taxes tr, .totals tr { page-break-inside: avoid; }
          .right { text-align: right; }
          .center { text-align: center; }
          .left { text-align: left; }
          .totals { margin-left: auto; min-width: 60mm; }
          .totals th { text-align: left; padding: 0.5mm 2mm; }
          .totals td { text-align: right; padding: 0.5mm 2mm; }
          .totals .words { text-align: left; font-weight: bold; }
          .blk-rule { border: 0; border-top: 1px solid #1f3a5f; }
          .blk-spacer { height: 4mm; }
          .blk-signature { border: 1px solid #1f3a5f; width: 60mm; height: 20mm; padding: 1mm; }
          .blk-qr { font-family: 'Courier New', monospace; font-size: 7pt; }
        </style>
      </head>
      <body>
        <xsl:for-each select="/n1:Invoice">
        <xsl:call-template name="section-header"/>
        <xsl:call-template name="section-parties"/>
        <xsl:call-template name="section-lines"/>
        <xsl:call-template name="section-totals"/>
        </xsl:for-each>
      </body>
    </html>
  </xsl:template>
  <xsl:template name="section-header">
    <div class="sec sec-header" id="sec-header">
      <table class="cols">
        <tr>
          <td style="width:33.33%">
            <img class="blk blk-logo" src="data:image/png;base64,iVBORw0KGgo=" alt="" style="width:30mm"/>
          </td>
          <td style="width:33.33%">
            <xsl:if test="string($watermark) != ''">
              <div class="blk blk-field" style="font-size:14pt;font-weight:bold;text-align:center">
                <span class="val">
                  <xsl:value-of select="$watermark"/>
                </span>
              </div>
            </xsl:if>
          </td>
          <td style="width:33.33%">
            <xsl:if test="string(cbc:ID) != ''">
              <div class="blk blk-field">
                <span class="lbl">Fatura No: </span>
                <span class="val">
                  <xsl:value-of select="cbc:ID"/>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cbc:IssueDate) != ''">
              <div class="blk blk-field">
                <span class="lbl">Fatura Tarihi: </span>
                <span class="val">
                  <xsl:call-template name="date-tr"><xsl:with-param name="d" select="cbc:IssueDate"/></xsl:call-template>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cbc:UUID) != ''">
              <div class="blk blk-field">
                <span class="lbl">ETTN: </span>
                <span class="val">
                  <xsl:value-of select="cbc:UUID"/>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cbc:DocumentCurrencyCode) != ''">
              <div class="blk blk-field">
                <span class="lbl">Para Birimi: </span>
                <span class="val">
                  <xsl:value-of select="cbc:DocumentCurrencyCode"/>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cac:PricingExchangeRate/cbc:CalculationRate) != ''">
              <div class="blk blk-field">
                <span class="lbl">Döviz Kuru: </span>
                <span class="val">
                  <xsl:call-template name="number-tr"><xsl:with-param name="v" select="cac:PricingExchangeRate/cbc:CalculationRate"/></xsl:call-template>
                </span>
              </div>
            </xsl:if>
          </td>
        </tr>
      </table>
    </div>
  </xsl:template>
  <xsl:template name="section-parties">
    <div class="sec sec-parties" id="sec-parties">
      <table class="cols">
        <tr>
          <td style="width:50%">
            <xsl:if test="string(cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name) != ''">
              <div class="blk blk-field" style="font-weight:bold">
                <span class="val">
                  <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name"/>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN' or @schemeID='TCKN']) != ''">
              <div class="blk blk-field">
                <span class="lbl">VKN/TCKN: </span>
                <span class="val">
                  <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN' or @schemeID='TCKN']"/>
                </span>
              </div>
            </xsl:if>
          </td>
          <td style="width:50%">
            <xsl:if test="string(cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name) != ''">
              <div class="blk blk-field" style="font-weight:bold">
                <span class="val">
                  <xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name"/>
                </span>
              </div>
            </xsl:if>
            <xsl:if test="string(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN' or @schemeID='TCKN']) != ''">
              <div class="blk blk-field">
                <span class="lbl">VKN/TCKN: </span>
                <span class="val">
                  <xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN' or @schemeID='TCKN']"/>
                </span>
              </div>
            </xsl:if>
          </td>
        </tr>
      </table>
    </div>
  </xsl:template>
  <xsl:template name="section-lines">
    <div class="sec sec-lines" id="sec-lines">
      <table class="blk lines">
        <thead>
          <tr>
            <th style="width:5%">Sıra</th>
            <th style="width:35%">Mal/Hizmet</th>
            <th style="width:10%;text-align:right">Miktar</th>
            <th style="width:15%;text-align:right">Birim Fiyat</th>
            <th style="width:10%;text-align:right">KDV %</th>
            <th style="width:10%;text-align:right">KDV</th>
            <th style="width:15%;text-align:right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          <xsl:for-each select="cac:InvoiceLine">
            <tr>
              <td>
                <xsl:value-of select="cbc:ID"/>
              </td>
              <td>
                <xsl:value-of select="cac:Item/cbc:Name"/>
              </td>
              <td class="right">
                <xsl:call-template name="number-tr"><xsl:with-param name="v" select="cbc:InvoicedQuantity"/></xsl:call-template>
              </td>
              <td class="right">
                <xsl:call-template name="money">
                  <xsl:with-param name="v" select="cac:Price/cbc:PriceAmount"/>
                  <xsl:with-param name="cur" select="cac:Price/cbc:PriceAmount/@currencyID"/>
                </xsl:call-template>
              </td>
              <td class="right">
                <xsl:text>%</xsl:text><xsl:call-template name="number-tr"><xsl:with-param name="v" select="cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode='0015']/cbc:Percent"/></xsl:call-template>
              </td>
              <td class="right">
                <xsl:call-template name="money">
                  <xsl:with-param name="v" select="cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode='0015']/cbc:TaxAmount"/>
                  <xsl:with-param name="cur" select="cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode='0015']/cbc:TaxAmount/@currencyID"/>
                </xsl:call-template>
              </td>
              <td class="right">
                <xsl:call-template name="money">
                  <xsl:with-param name="v" select="cbc:LineExtensionAmount"/>
                  <xsl:with-param name="cur" select="cbc:LineExtensionAmount/@currencyID"/>
                </xsl:call-template>
              </td>
            </tr>
          </xsl:for-each>
        </tbody>
      </table>
    </div>
  </xsl:template>
  <xsl:template name="section-totals">
    <div class="sec sec-totals" id="sec-totals">
      <table class="blk totals">
        <tr>
          <th>Mal Hizmet Toplam Tutarı</th>
          <td>
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/>
              <xsl:with-param name="cur" select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount/@currencyID"/>
            </xsl:call-template>
          </td>
        </tr>
        <tr>
          <th>Vergi Hariç Tutar</th>
          <td>
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"/>
              <xsl:with-param name="cur" select="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount/@currencyID"/>
            </xsl:call-template>
          </td>
        </tr>
        <tr>
          <th>Hesaplanan KDV</th>
          <td>
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:TaxTotal/cbc:TaxAmount"/>
              <xsl:with-param name="cur" select="cac:TaxTotal/cbc:TaxAmount/@currencyID"/>
            </xsl:call-template>
          </td>
        </tr>
        <tr>
          <th>Vergiler Dahil Toplam Tutar</th>
          <td>
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/>
              <xsl:with-param name="cur" select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount/@currencyID"/>
            </xsl:call-template>
          </td>
        </tr>
        <tr>
          <th>Ödenecek Tutar</th>
          <td>
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:LegalMonetaryTotal/cbc:PayableAmount"/>
              <xsl:with-param name="cur" select="cac:LegalMonetaryTotal/cbc:PayableAmount/@currencyID"/>
            </xsl:call-template>
          </td>
        </tr>
      </table>
      <xsl:if test="string(cac:LegalMonetaryTotal/cbc:PayableAmount) != ''">
        <div class="blk blk-field">
          <span class="lbl">Ödenecek (USD): </span>
          <span class="val">
            <xsl:call-template name="money">
              <xsl:with-param name="v" select="cac:LegalMonetaryTotal/cbc:PayableAmount"/>
              <xsl:with-param name="cur" select="cac:LegalMonetaryTotal/cbc:PayableAmount/@currencyID"/>
            </xsl:call-template>
          </span>
        </div>
      </xsl:if>
    </div>
  </xsl:template>
</xsl:stylesheet>
